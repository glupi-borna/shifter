'use strict';

class FFT {
    /** @type {Record<number, Float32Array>}*/
    static bitrev_cache = {};
    /** @type {Record<number, Float32Array>}*/
    static table_cache = {};

    size = NaN;
    complex_size = NaN;
    width = NaN;

    /** @type {number} */
    inv = NaN;

    /** @type {Float32Array} */
    table  = null;
    /** @type {Float32Array} */
    bitrev = null;

    /** @type {Float32Array} */
    out  = null;
    /** @type {Float32Array} */
    data = null;

    /**
     * @param {number} power - The power of 2 that determines the size of the FFT.
     */
    constructor(power) {
        power = Math.max(power, 1);
        this.size = 2 ** power;
        this.complex_size = this.size << 1;

        if (FFT.table_cache[this.size * 2]) {
            this.table = FFT.table_cache[this.size * 2];
        } else {
            let table = new Float32Array(this.size * 2);
            let invsize = 1 / this.size;

            for (let i = 0; i < table.length; i += 2) {
                let angle = Math.PI * i * invsize;
                table[i] = Math.cos(angle);
                table[i + 1] = -Math.sin(angle);
            }

            FFT.table_cache[this.size * 2] = table;
            this.table = table;
        }

        // Calculate initial step's width:
        //   * If we are full radix-4 - it is 2x smaller to give inital len=8
        //   * Otherwise it is the same as `power` to give len=4
        this.width = power % 2 === 0 ? power - 1 : power;

        let w = 1 << this.width;
        if (FFT.bitrev_cache[w]) {
            this.bitrev = FFT.bitrev_cache[w];
        } else {
            this.bitrev = new Float32Array(w);
            for (let j = 0; j < w; j++) {
                this.bitrev[j] = 0;
                for (let shift = 0; shift < this.width; shift += 2) {
                    let revShift = this.width - shift - 2;
                    this.bitrev[j] |= ((j >>> shift) & 3) << revShift;
                }
            }

            FFT.bitrev_cache[w] = this.bitrev;
        }

        this.inv = 0;
    }

    /**
     * @param {Float32Array} complex
     * @param {Float32Array} storage
     */
    fromComplexArray(complex, storage) {
        let res = storage || new Float32Array(complex.length >>> 1);
        let len = complex.length;
        for (let i = 0; i < len; i += 2)
            res[i >>> 1] = complex[i];
        return res;
    }

    createComplexArray() {
        return new Float32Array(this.complex_size);
    }

    /**
     * @param {Float32Array} input
     * @param {Float32Array} storage
     */
    toComplexArray(input, storage) {
        let res = storage || this.createComplexArray();
        for (let i = 0; i < res.length; i += 2) {
            res[i] = input[i >>> 1];
            res[i + 1] = 0;
        }
        return res;
    }

    /**
     * @param {Float32Array} spectrum
     */
    completeSpectrum(spectrum) {
        let size = this.complex_size;
        let half = size >>> 1;
        for (let i = 2; i < half; i += 2) {
            spectrum[size - i] = spectrum[i];
            spectrum[size - i + 1] = -spectrum[i + 1];
        }
    }

    /**
     * @param {Float32Array} out
     * @param {Float32Array} data
     */
    transform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this.inv = 0;
        this.out  = out;
        this.data = data;
        this._transform4();
        this.out = null;
        this.data = null;
    }

    /**
     * @param {Float32Array} out
     * @param {Float32Array} data
     */
    realTransform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this.inv = 0;
        this.out  = out;
        this.data = data;
        this._realTransform4();
        this.out = null;
        this.data = null;
    }

    /**
     * @param {Float32Array} out
     * @param {Float32Array} data
     */
    inverseTransform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this.inv = 1;
        this.out = out;
        this.data = data;
        this._transform4();

        let inv_size = 1 / this.size;
        for (let i = 0; i < out.length; ++i)
            out[i] *= inv_size;

        this.out = null;
        this.data = null;
    }

    /**
     * radix-4 implementation
     */
    _transform4() {
        let size = this.complex_size;

        // Initial step (permute and transform)
        let width = this.width;
        let step = 1 << width;
        let len = (size / step) << 1;

        let outOff;
        let t;
        let bitrev = this.bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                let off = bitrev[t];
                this._singleTransform2(outOff, off, step);
            }
        } else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                let off = bitrev[t];
                this._singleTransform4(outOff, off, step);
            }
        }

        // Loop through steps in decreasing order
        let inv = this.inv ? -1 : 1;
        let table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            let quarterLen = len >>> 2;

            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                // Full case
                let limit = outOff + quarterLen;
                for (let i = outOff, k = 0; i < limit; i += 2, k += step) {
                    let A = i;
                    let B = A + quarterLen;
                    let C = B + quarterLen;
                    let D = C + quarterLen;

                    // Original values
                    let Ar = this.out[A];
                    let Ai = this.out[A + 1];
                    let Br = this.out[B];
                    let Bi = this.out[B + 1];
                    let Cr = this.out[C];
                    let Ci = this.out[C + 1];
                    let Dr = this.out[D];
                    let Di = this.out[D + 1];

                    let tableBr = table[k];
                    let tableBi = inv * table[k + 1];
                    let tableCr = table[2 * k];
                    let tableCi = inv * table[2 * k + 1];
                    let tableDr = table[3 * k];
                    let tableDi = inv * table[3 * k + 1];

                    // Middle values
                    let MBr = Br * tableBr - Bi * tableBi;
                    let MBi = Br * tableBi + Bi * tableBr;

                    let MCr = Cr * tableCr - Ci * tableCi;
                    let MCi = Cr * tableCi + Ci * tableCr;

                    let MDr = Dr * tableDr - Di * tableDi;
                    let MDi = Dr * tableDi + Di * tableDr;

                    // Pre-Final values
                    let T0r = Ar + MCr;
                    let T0i = Ai + MCi;
                    let T1r = Ar - MCr;
                    let T1i = Ai - MCi;
                    let T2r = MBr + MDr;
                    let T2i = MBi + MDi;
                    let T3r = inv * (MBr - MDr);
                    let T3i = inv * (MBi - MDi);

                    // Final values
                    this.out[A]     = T0r + T2r;
                    this.out[A + 1] = T0i + T2i;

                    this.out[C]     = T0r - T2r;
                    this.out[C + 1] = T0i - T2i;

                    this.out[B]     = T1r + T3i;
                    this.out[B + 1] = T1i - T3r;

                    this.out[D]     = T1r - T3i;
                    this.out[D + 1] = T1i + T3r;
                }
            }
        }
    }

    /**
     * radix-2 implementation
     * NOTE: Only called for len=4
     * @param {number} outOff
     * @param {number} off
     * @param {number} step
     */
    _singleTransform2(outOff, off, step) {
        this.out[outOff++] = this.data[off]     + this.data[off + step];
        this.out[outOff++] = this.data[off + 1] + this.data[off + step + 1];
        this.out[outOff++] = this.data[off]     - this.data[off + step];
        this.out[outOff]   = this.data[off + 1] - this.data[off + step + 1];
    }

    /**
     * radix-4 implementation
     * NOTE: Only called for len=8
     * @param {number} outOff
     * @param {number} off
     * @param {number} step
     */
    _singleTransform4(outOff, off, step) {
        let inv = this.inv ? -1 : 1;
        let step2 = step * 2;
        let step3 = step * 3;

        // Original values
        let Ar = this.data[off];
        let Ai = this.data[off + 1];
        let Br = this.data[off + step];
        let Bi = this.data[off + step + 1];
        let Cr = this.data[off + step2];
        let Ci = this.data[off + step2 + 1];
        let Dr = this.data[off + step3];
        let Di = this.data[off + step3 + 1];

        // Pre-Final values
        let T0r = Ar + Cr;
        let T0i = Ai + Ci;
        let T1r = Ar - Cr;
        let T1i = Ai - Ci;
        let T2r = Br + Dr;
        let T2i = Bi + Di;
        let T3r = inv * (Br - Dr);
        let T3i = inv * (Bi - Di);

        this.out[outOff]     = T0r + T2r;
        this.out[outOff + 1] = T0i + T2i;
        this.out[outOff + 2] = T1r + T3i;
        this.out[outOff + 3] = T1i - T3r;
        this.out[outOff + 4] = T0r - T2r;
        this.out[outOff + 5] = T0i - T2i;
        this.out[outOff + 6] = T1r - T3i;
        this.out[outOff + 7] = T1i + T3r;
    }

    /**
     * Real input radix-4 implementation
     */
    _realTransform4() {
        let size = this.complex_size;

        // Initial step (permute and transform)
        let width = this.width;
        let step = 1 << width;
        let len = (size / step) << 1;

        let outOff;
        let t;
        let bitrev = this.bitrev;

        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                this._singleRealTransform2(outOff, bitrev[t] >>> 1, step >>> 1);
            }
        }
        else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                this._singleRealTransform4(outOff, bitrev[t] >>> 1, step >>> 1);
            }
        }

        // Loop through steps in decreasing order
        let inv = this.inv ? -1 : 1;
        let table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            let halfLen = len >>> 1;
            let quarterLen = halfLen >>> 1;
            let hquarterLen = quarterLen >>> 1;

            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                for (let i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
                    let A = outOff + i;
                    let B = A + quarterLen;
                    let C = B + quarterLen;
                    let D = C + quarterLen;

                    // Original values
                    let Ar = this.out[A];
                    let Ai = this.out[A + 1];
                    let Br = this.out[B];
                    let Bi = this.out[B + 1];
                    let Cr = this.out[C];
                    let Ci = this.out[C + 1];
                    let Dr = this.out[D];
                    let Di = this.out[D + 1];

                    // Middle values
                    let tableBr = table[k];
                    let tableBi = inv * table[k + 1];
                    let tableCr = table[2 * k];
                    let tableCi = inv * table[2 * k + 1];
                    let tableDr = table[3 * k];
                    let tableDi = inv * table[3 * k + 1];

                    let MBr = Br * tableBr - Bi * tableBi;
                    let MBi = Br * tableBi + Bi * tableBr;

                    let MCr = Cr * tableCr - Ci * tableCi;
                    let MCi = Cr * tableCi + Ci * tableCr;

                    let MDr = Dr * tableDr - Di * tableDi;
                    let MDi = Dr * tableDi + Di * tableDr;

                    // Pre-Final values
                    let T0r = Ar + MCr;
                    let T0i = Ai + MCi;
                    let T1r = Ar - MCr;
                    let T1i = Ai - MCi;
                    let T2r = MBr + MDr;
                    let T2i = MBi + MDi;
                    let T3r = inv * (MBr - MDr);
                    let T3i = inv * (MBi - MDi);

                    // Final values
                    let FAr = T0r + T2r;
                    let FAi = T0i + T2i;

                    let FBr = T1r + T3i;
                    let FBi = T1i - T3r;

                    this.out[A] = FAr;
                    this.out[A + 1] = FAi;
                    this.out[B] = FBr;
                    this.out[B + 1] = FBi;

                    // Output final middle point
                    if (i === 0) {
                        let FCr = T0r - T2r;
                        let FCi = T0i - T2i;
                        this.out[C] = FCr;
                        this.out[C + 1] = FCi;
                        continue;
                    }

                    // Do not overwrite ourselves
                    if (i === hquarterLen)
                        continue;

                    let SA = outOff + quarterLen - i;
                    let SB = outOff + halfLen - i;

                    this.out[SA] = T1r - inv * T3i;
                    this.out[SA + 1] = -T1i - inv * T3r;
                    this.out[SB] = T0r - inv * T2r;
                    this.out[SB + 1] = -T0i + inv * T2i;
                }
            }
        }
    }

    /**
     * radix-2 implementation
     * NOTE: Only called for len=4
     * @param {number} outOff
     * @param {number} off
     * @param {number} step
     */
    _singleRealTransform2(outOff, off, step) {
        let evenR = this.data[off];
        let oddR = this.data[off + step];

        let leftR = evenR + oddR;
        let rightR = evenR - oddR;

        this.out[outOff++] = leftR;
        this.out[outOff++] = 0;
        this.out[outOff++] = rightR;
        this.out[outOff]   = 0;
    }

    /**
     * radix-4 implementation
     * NOTE: Only called for len=8
     * @param {number} outOff
     * @param {number} off
     * @param {number} step
     */
    _singleRealTransform4(outOff, off, step) {
        let inv = this.inv ? -1 : 1;

        // Original values
        let Ar = this.data[off];
        let Br = this.data[off + step];
        let Cr = this.data[off + step * 2];
        let Dr = this.data[off + step * 3];

        // Pre-Final values
        let T0r = Ar + Cr;
        let T1r = Ar - Cr;
        let T2r = Br + Dr;
        let T3r = inv * (Br - Dr);

        // Final values

        this.out[outOff] = T0r + T2r;
        this.out[outOff + 1] = 0;
        this.out[outOff + 2] = T1r;
        this.out[outOff + 3] = -T3r;
        this.out[outOff + 4] = T0r - T2r;
        this.out[outOff + 5] = 0;
        this.out[outOff + 6] = T1r;
        this.out[outOff + 7] = T3r;
    }
}
export default FFT;













