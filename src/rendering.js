window.render_all = async function render_all() {
	let w = window.innerWidth;
	let h = 200;

	input.canvas.width = w;
	input.canvas.height = h;

	output.canvas.width = w;
	output.canvas.height = h;

	let promises = [
		render_audio(input),
		render_audio(output)
	];

	await Promise.all(promises);
}

/**
 * @param {Audio} audio
 * @param {JobData} job_data
 */
function* render_audio_line(audio, job_data) {
	let ctx = audio.line_canvas.getContext('2d');

	let total_height = audio.canvas.height;
	let sample_width = 2;
	let total_samples = audio.canvas.width / sample_width;
	let channel_height = total_height / audio.buffer.numberOfChannels;
	let sample_step = Math.max(Math.floor(audio.buffer.length / total_samples), 1);

	ctx.fillStyle = "white";
	ctx.strokeStyle = "white";
	ctx.globalAlpha = Math.min(5 / sample_step, 1);

	ctx.clearRect(0, 0, audio.canvas.width, total_height);

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

	ctx.stroke();
	return undefined;
}

/**
 * @param {Audio} audio
 * @param {JobData} job_data
 */
function* render_audio_amplitude(audio, job_data) {
	let ctx = audio.amp_canvas.getContext('2d');

	let total_height = audio.canvas.height;
	let sample_width = 2;
	let total_samples = audio.canvas.width / sample_width;
	let channel_height = total_height / audio.buffer.numberOfChannels;
	let sample_step = Math.max(Math.floor(audio.buffer.length / total_samples), 1);
	let inv_sample_step = 1 / sample_step;

	for (let ch_ind = 0; ch_ind < audio.buffer.numberOfChannels; ch_ind++) {
		ctx.fillStyle = "white";
		ctx.strokeStyle = "white";

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

			ctx.globalAlpha = (1 - Math.min(5 / sample_step, 1)) * 0.5;
			ctx.clearRect(i * sample_width, ch_ind * channel_height, sample_width, channel_height);
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
	let ctx = audio.fft_canvas.getContext('2d');
	ctx.fillStyle = "white";
	ctx.strokeStyle = "transparent";

	let sample_width = 8;
	let total_samples = audio.canvas.width / sample_width;
	let total_height = audio.canvas.height;
	let block_height = total_height / 32;

	let f = new FFT(6);
	let fft_out = f.createComplexArray();

	let ch_num = audio.buffer.numberOfChannels;

	for (let ch_ind = 0; ch_ind < ch_num; ch_ind++) {
		let channel = audio.buffer.getChannelData(ch_ind);

		for (let i = 0; i < total_samples; i++) {
			let start = Math.floor(Math.remap(i, 0, total_samples, 0, audio.buffer.length));
			start = Math.min(start, audio.buffer.length - f.size);
			f.realTransform(fft_out, channel.slice(start, start + f.size));

			for (let ind = 0; ind < f.size; ind += 2) {
				let y = Math.remap(ind * 0.5, 33, 0, 0, total_height);

				if (ch_ind == 0)
					ctx.clearRect(i * sample_width, y, sample_width, block_height);
				ctx.globalAlpha = Math.clamp(Math.hypot(fft_out[ind], fft_out[ind+1]) / 33, 0, 1);
				ctx.fillRect(i * sample_width, y, sample_width, block_height);
			}

			if (!job_data.is_running) return JOB_KILLED;
			yield;
		}
	}

	return undefined;
}

/**
 * @param {Audio} audio
 * @param {(audio: Audio, job_data: JobData) => Generator<any, Symbol, unknown>} func
 */
function render_audio_func(audio, func) {
	return new Promise(resolve => {
		if (!audio.buffer) {
			resolve(JOB_KILLED);
			return;
		}

		let render_job = job(JOB_RENDER, audio.canvas);
		let gen = func(audio, render_job);
		let res = gen.next();
		let done = res.done;

		let interval = setInterval(() => {
			let t1 = performance.now();

			while (!done) {
				if (!audio.buffer) {
					job_terminate(render_job);
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
				if (res.value !== JOB_KILLED && res.value !== null) {
					resolve(res.value);
				} else {
					resolve(JOB_KILLED);
				}

				job_terminate(render_job);
				clearInterval(interval);
			}
		});
	});
}

window.render_audio = function render_audio(audio) {
	return new Promise(async (resolve) => {
		let ctx = audio.canvas.getContext('2d');
		ctx.clearRect(0, 0, audio.canvas.width, audio.canvas.height);

		try {
			ctx.drawImage(audio.fft_canvas, 0, 0, audio.canvas.width, audio.canvas.height);
			ctx.drawImage(audio.amp_canvas, 0, 0, audio.canvas.width, audio.canvas.height);
			ctx.drawImage(audio.line_canvas, 0, 0, audio.canvas.width, audio.canvas.height);
		} catch {

		}

		audio.fft_canvas.width = audio.canvas.width;
		audio.fft_canvas.height = audio.canvas.height;
		audio.amp_canvas.width = audio.canvas.width;
		audio.amp_canvas.height = audio.canvas.height;
		audio.line_canvas.width = audio.canvas.width;
		audio.line_canvas.height = audio.canvas.height;

		let res = await render_audio_func(audio, render_audio_amplitude);
		if (res === JOB_KILLED) {
			resolve(undefined);
			return;
		}

		res = await render_audio_func(audio, render_audio_line);
		if (res === JOB_KILLED) {
			resolve(undefined);
			return;
		}

		res = await render_audio_func(audio, render_audio_fft);
		if (res === JOB_KILLED) {
			resolve(undefined);
			return;
		}

		ctx.clearRect(0, 0, audio.canvas.width, audio.canvas.height);
		ctx.drawImage(audio.fft_canvas, 0, 0);
		ctx.drawImage(audio.amp_canvas, 0, 0);
		ctx.drawImage(audio.line_canvas, 0, 0);
		resolve(undefined);
	});
}