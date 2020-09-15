declare var curve: (formula: string) => (x: number, ...args: number[]) => number;
declare var params_curve: (number_of_params: number, formula: string) => (...p: any[]) => number;
declare var churn_curve: (formula: string) => (x: number, t: number, p: number, freq: number, period: number, ind: number, len: number, invlen: number, buf: AudioBuffer, ch: Float32Array, chind: number, chnum: number) => number;

declare var filter_update_cache: (filter: Filter<any>, buffer: AudioBuffer) => AudioBuffer;
declare var filter_get_cache_string: (filter: Filter<any>) => string;
declare var filter_invalidate_cache: (filter: Filter<any>) => void;
declare var filter_create: <T>(filter: Filter<T>) => Filter<T>;
declare var filter_container: (filter: Filter<any>, filter_name: string) => HTMLElement;

declare var fft_resolution: (sample_rate: number, fft_len: number) => number;
declare var fft_freq: (fft_index: number, fft_resolution: number) => number;
declare var filter_run: (input_buffer: AudioBuffer | null, filter: Filter<any>) => Promise<AudioBuffer | Symbol | null>;
declare var filter_apply_pipeline: () => void;

declare var filters: Record<string, Filter<any>>;
declare var filter_pipeline: Filter<any>[];

interface SampleData {
	time: number;
	volume: number;
	progress: number;
	sample_rate: number;
	sample_period: number;
	sample_index: number;
	sample_count: number;
	sample_count_inv: number;
	buffer: AudioBuffer;
	channel_data: Float32Array;
	channel_index: number;
	channel_count: number;
}

interface FilterBase<T extends Record<string, any>> {
	type: string;
	mix_factor?: number;
	enabled?: boolean;
	target_channels?: boolean[];
	cache_invalidated?: Signal<void>;
	settings?: T;
	mode?: 'multiply' | 'add';
	fn: Function;
	before_processing?: (settings?: T) => void;
	// @TODO: after_processing, on_load, on_unload
	display: (filter?: Filter<T>) => HTMLElement;
	cache_string?: string;
	cache_buffer?: AudioBuffer;
	container?: HTMLDivElement;
}

interface SampleFilter<T> extends FilterBase<T> {
	type: 'sample';
	fn: (sample: SampleData, settings: T) => (number | number[] | null | undefined);
}

interface FFTFilter<T> extends FilterBase<T> {
	type: 'fft';
	fft_power: number,
	fn: (fft: Float32Array, fft_resolution: number, settings: T) => Float32Array;
}

interface GeneratorFilter<T> extends FilterBase<T> {
	type: 'generator';
	duration?: number;
	channels?: number;
	fn: (settings: T) => number;
}

interface BufferFilter<T> extends FilterBase<T> {
	type: 'buffer';
	fn: (buffer: AudioBuffer, filter: BufferFilter<T>) => AudioBuffer;
}

type Filter<T> = SampleFilter<T> | BufferFilter<T> | FFTFilter<T> | GeneratorFilter<T>;