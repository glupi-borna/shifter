window.render_all = function render_all() {
	let w = window.innerWidth;
	let h = 200;

	input.canvas.width = w;
	input.canvas.height = h;

	output.canvas.width = w;
	output.canvas.height = h;

	for (let audio of [input, output]) {
		let ctx = audio.canvas.getContext('2d');

		ctx.clearRect(0, 0, audio.canvas.width, audio.canvas.height);
		for (let [key, canvas] of audio.offscreen_canvas_map) {
			if (key.endsWith("_PREV")) {
				ctx.drawImage(canvas, 0, 0, audio.canvas.width, audio.canvas.height);
			} else {
				canvas.width = w;
				canvas.height = h;
			}
		}
	}

	let promises = [
		render_audio(input),
		render_audio(output)
	];

	return Promise.all(promises).then();
}

/**
 * @param {Audio} audio
 * @param {JobData} _
 */
function* render_audio_line(audio, _) {
	let canvas = audio_get_canvas(audio, "line");
	let ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (!audio.render_amp)
		return undefined;

	let total_height = audio.canvas.height;
	let sample_width = 2;
	let total_samples = audio.canvas.width / sample_width;
	let channel_height = total_height / audio.buffer.numberOfChannels;
	let sample_step = Math.max(Math.floor(audio.buffer.length / total_samples), 1);

	ctx.beginPath();

	for (let ch_ind = 0; ch_ind < audio.buffer.numberOfChannels; ch_ind++) {
		let y = (ch_ind + 0.5) * channel_height;
		ctx.moveTo(0, y);

		let channel = audio.buffer.getChannelData(ch_ind);

		for (let i = 0; i < total_samples; i++) {
			let vol = Math.clamp(channel[i * sample_step], -1, 1);
			ctx.lineTo(i * sample_width, y - vol * channel_height * 0.45);
		}
	}

	let color = `rgb(255,255,255,${Math.min(5 / sample_step, 1)})`;
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.stroke();
	return undefined;
}

/**
 * @param {Audio} audio
 * @param {JobData} job_data
 */
function* render_audio_amplitude(audio, job_data) {
	let canvas = audio_get_canvas(audio, "amp");
	let ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (!audio.render_amp)
		return undefined;

	let total_height = audio.canvas.height;
	let sample_width = 2;
	let total_samples = audio.canvas.width / sample_width;
	let channel_height = total_height / audio.buffer.numberOfChannels;
	let sample_step = Math.max(Math.floor(audio.buffer.length / total_samples), 1);
	let inv_sample_step = 1 / sample_step;

	let alpha = (1 - Math.min(5 / sample_step, 1)) * 0.5;

	for (let ch_ind = 0; ch_ind < audio.buffer.numberOfChannels; ch_ind++) {
		let y = (ch_ind + 0.5) * channel_height;
		let channel = audio.buffer.getChannelData(ch_ind);

		for (let i = 0; i < total_samples; i++) {
			let avg = 0;
			let sign = 0;

			for (let j = 0; j < sample_step; j++) {
				sign += Math.sign(channel[i*sample_step+j]);
				avg += Math.abs(channel[i*sample_step+j]) * inv_sample_step;
			}

			let vol = Math.clamp(avg * (Math.sign(sign) || 1), -1, 1);
			let line_height = vol * channel_height * 0.9;

			if (!job_data.is_running) return JOB_KILLED;
			yield;
			let color = `rgb(255,255,255,${alpha})`;
			ctx.fillStyle = color;
			ctx.strokeStyle = color;
			ctx.fillRect(i * sample_width, y - line_height * 0.5, sample_width - 1, line_height);
		}
	}

	return undefined;
}

/**
 * @param {Audio} audio
 * @param {JobData} job_data
 */
function* render_audio_fft(audio, job_data) {
	let canvas = audio_get_canvas(audio, "fft");
	let ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (!audio.render_fft)
		return undefined;

	ctx.fillStyle = "white";
	ctx.strokeStyle = "transparent";

	let sample_width = 32;
	let total_samples = canvas.width / sample_width;
	let total_height = canvas.height;

	let fft_power = Math.ceil(Math.log2(ctx.canvas.height));
	let fft_buckets = 2 ** fft_power;
	let block_height = total_height / fft_buckets;

	let f = new FFT(fft_power);
	let fft_out = f.createComplexArray();
	let inv_len = 1 / f.size;

	let ch_num = audio.buffer.numberOfChannels;

	for (let ch_ind = 0; ch_ind < ch_num; ch_ind++) {
		let channel = audio.buffer.getChannelData(ch_ind);

		for (let i = 0; i < total_samples; i++) {
			let start = Math.floor(Math.remap(i, 0, total_samples, 0, audio.buffer.length));
			start = Math.min(start, audio.buffer.length - f.size);
			f.realTransform(fft_out, channel.slice(start, start + f.size));

			let x = i * sample_width;
			for (let ind = 0; ind < f.size; ind += 2) {
				let y = Math.remap(ind * 0.5, fft_buckets / 2 + 1, 0, total_height * 0.05, total_height * 0.95);
				let alpha = Math.clamp(Math.hypot(fft_out[ind], fft_out[ind+1]) * inv_len, 0, 1);
				ctx.fillStyle = `rgb(${i},255,255,${alpha})`;
				ctx.fillRect(x, y, sample_width, block_height);
			}

			if (!job_data.is_running)
				return JOB_KILLED;

			yield;
		}
	}

	return undefined;
}

/**
 * @param {Audio} audio
 * @param {JobData} job_data
 * @param {(audio: Audio, job_data: JobData) => Generator<any, Symbol, unknown>} func
 */
function render_audio_func(audio, job_data, func) {
	return new Promise(resolve => {
		if (!audio.buffer || audio.canvas.height === 0 || audio.canvas.width === 0) {
			resolve(JOB_KILLED);
			return;
		}

		let gen = func(audio, job_data);
		let res = gen.next();
		let done = res.done;

		let interval = setInterval(() => {
			let t1 = performance.now();

			while (!done) {
				if (!audio.buffer) {
					resolve(JOB_KILLED);
					clearInterval(interval);
					return;
				}

				res = gen.next();
				done = res.done;

				if (performance.now() - t1 > 16) {
					break;
				}
			}

			if (done) {
				if (res.value !== JOB_KILLED) {
					resolve(res.value);
				} else {
					resolve(JOB_KILLED);
				}

				clearInterval(interval);
			}
		}, 2);
	});
}

/** @arg {OffscreenCanvas} canvas */
function canvas_copy(canvas) {
	let new_canvas = new OffscreenCanvas(canvas.width, canvas.height);
	let new_ctx = new_canvas.getContext("2d");
	new_ctx.drawImage(canvas, 0, 0);
	return new_canvas;
}

/**
@arg {Audio} audio
@arg {string} name
*/
function audio_get_canvas(audio, name) {
	let target;
	if (audio.offscreen_canvas_map.has(name)) {
		target = audio.offscreen_canvas_map.get(name);
	} else {
		target = new OffscreenCanvas(audio.canvas.width, audio.canvas.height);
		audio.offscreen_canvas_map.set(name, target);
	}

	if (!name.endsWith("_PREV") && !audio.offscreen_canvas_map.has(name + "_PREV")) {
		audio.offscreen_canvas_map.set(name + "_PREV", canvas_copy(target));
	}

	return target;
}

/**
@arg {Audio} audio
@arg {string} name
*/
function audio_backup_canvas(audio, name) {
	let target = audio_get_canvas(audio, name);
	let backup = audio_get_canvas(audio, name + "_PREV");
	backup.width = target.width;
	backup.height = target.height;
	let ctx = backup.getContext("2d");
	ctx.clearRect(0, 0, backup.width, backup.height);
	ctx.drawImage(target, 0, 0);
}

let last_job_data = null;
window.render_audio = function render_audio(audio) {
	job_terminate(last_job_data);
	let job_data = job(JOB_RENDER, audio);
	last_job_data = job_data;

	return new Promise(async (resolve) => {

		let promises = [];
		promises.push(render_audio_func(audio, job_data, render_audio_amplitude));
		promises.push(render_audio_func(audio, job_data, render_audio_line));
		promises.push(render_audio_func(audio, job_data, render_audio_fft));

		Promise.all(promises).then(res => {
			if (!res.includes(JOB_KILLED)) {
				resolve(undefined);
			} else {
				resolve(JOB_KILLED);
				job_terminate(job_data);
			}
		});
	}).then((res) => {
		let ctx = audio.canvas.getContext('2d');

		if (res !== JOB_KILLED) {
			for (let [key, _] of audio.offscreen_canvas_map) {
				if (!key.endsWith("_PREV")) {
					audio_backup_canvas(audio, key);
				}
			}
			console.log("Backed up!");
		}

		ctx.clearRect(0, 0, audio.canvas.width, audio.canvas.height);
		for (let [key, canvas] of audio.offscreen_canvas_map) {
			if (key.endsWith("_PREV")) {
				ctx.drawImage(canvas, 0, 0, audio.canvas.width, audio.canvas.height);
				if (canvas.width !== audio.canvas.width || canvas.height !== audio.canvas.height) {
					canvas.width = audio.canvas.width;
					canvas.height = audio.canvas.height;
				}
			}
		}
	});
}