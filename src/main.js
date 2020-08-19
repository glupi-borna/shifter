import "./overrides.js";
globalize(Math);
import FFT from "./fft.js";
const audio_context = new AudioContext();

window.latest_filter_job = null;
window.job_kill_signal = new Signal(null);
window.JOB_KILLED = Symbol("Job killed!");

window._cur_id = 0;
window.inc_id = function() {
	return _cur_id++;
}

watch_stylesheet(pwd + "/style.scss", "mainStyle");

window.input = {
	canvas: null,
	buffer: null,
	source: null,
	button: null,
	is_playing: false,
	context: audio_context
};

window.output = {
	canvas: null,
	buffer: null,
	source: null,
	button: null,
	is_playing: false,
	context: audio_context
};

window.shift_down = false;
window.alt_down = false;
window.ctrl_down = false;

/** @type {Filter<any>[]} */
let pipeline = [];

window.onkeydown = (/** @type {KeyboardEvent} */ ev) => {
	shift_down = ev.shiftKey;
	alt_down = ev.altKey;
	ctrl_down = ev.ctrlKey;
}

window.onkeyup = (/** @type {KeyboardEvent} */ ev) => {
	shift_down = ev.shiftKey;
	alt_down = ev.altKey;
	ctrl_down = ev.ctrlKey;
}

window.onkeypress = (/** @type {KeyboardEvent} */ ev) => {
	if (ev.key === "i") {
		play_audio(input);
	} else if (ev.key === "o") {
		play_audio(output);
	}
}

window.onload = () => {
	/** @type {HTMLInputElement} */
	let file_input = find("#fileInput");
	file_input.on('input', () => {
		open_audio_file(file_input, input.context)
		.then(audio => {
			input.buffer = audio;
			set_source(input);
			apply_pipeline();
			render_all();
		});
	});

	input.canvas  = find("#inputCanvas");
	input.button  = find("#inputButton");
	input.button.onclick = play_audio.bind(input.button, input);
	output.canvas = find("#outputCanvas");
	output.button = find("#outputButton");
	output.button.onclick = play_audio.bind(output.button, output);

	let pipeline_container = find("#pipelineContainer");
	pipeline_container.append(
		el('div').set_class('drop-before', 'yellow', 'dent')
		.allow_dropping("filters", (ev) => {
			let container_id = ev.dataTransfer.getData("text/container_id")
			let container = document.getElementById(container_id);
			let filter = container.store.filter;
			let ind = pipeline.indexOf(filter);

			pipeline.splice(ind, 1);
			pipeline.unshift(filter);

			pipeline_container.firstElementChild.append_after(container);
			invalidate_filter_cache(filter);
			apply_pipeline();
		}),

		el('div').set_class('drop-before', 'yellow', 'dent')
		.allow_dropping("filters", (ev) => {
			let container_id = ev.dataTransfer.getData("text/container_id")
			let container = document.getElementById(container_id);
			let filter = container.store.filter;
			let ind = pipeline.indexOf(filter);

			pipeline.splice(ind, 1);
			pipeline.push(filter);

			pipeline_container.lastElementChild.append_before(container);
			invalidate_filter_cache(filter);
			apply_pipeline();
		})
	);

	/** @type {HTMLSelectElement} */
	let select = find("#filterSelectElement");
	for (let key in filters) {
		let filter_option = el('option');
		filter_option.innerHTML = key;
		filter_option.value = key;
		select.appendChild(filter_option);
	}

	/** @type {HTMLButtonElement} */
	let add_filter = find("#pipelineAddButton");
	add_filter.onclick = () => {
		let filter = shallow_copy(filters[select.value]);
		if (filter.settings) {
			filter.settings = shallow_copy(filter.settings);
		}
		filter.enabled = true;
		filter.mix_factor = 1;
		pipeline.push(filter);
		pipeline_container.lastElementChild.append_before(filter_container(filter, select.value));
		apply_pipeline();
	};

	render_all();
};
window.onresize = render_all;

/** @arg {Audio} audio */
function set_source(audio) {
	audio.source = audio.context.createBufferSource();
	audio.source.buffer = audio.buffer;
	audio.source.connect(audio.context.destination);
	audio.is_playing = false;
	audio.source.onended = () => {
		audio.source.disconnect();
		set_source(audio);
	};
}

/** @arg {Audio} audio */
function play_audio(audio) {
	if (audio.is_playing) {
		set_source(audio);
	}
	audio.is_playing = true;

	setTimeout(() => {
		audio.source.start();
	}, 1);
}

function render_all() {
	input.canvas.width = window.innerWidth;
	input.canvas.height = window.innerHeight * 0.3;
	output.canvas.width = window.innerWidth;
	output.canvas.height = window.innerHeight * 0.3;
	render_audio(input);
	render_audio(output);
}

window.render_audio = function render_audio(audio) {
	let ctx = audio.canvas.getContext('2d');
	ctx.fillStyle = "transparent";
	ctx.strokeStyle = "white";
	ctx.clearRect(0,0,audio.canvas.width,audio.canvas.height);

	if (!audio.buffer) {
		return;
	}

	let total_height = audio.canvas.height;
	let sample_width = 2;
	let total_samples = audio.canvas.width / sample_width;
	let channel_height = total_height / audio.buffer.numberOfChannels;
	let sample_step = Math.floor(audio.buffer.length / total_samples);

	ctx.beginPath();

	for (let ch_ind = 0; ch_ind < audio.buffer.numberOfChannels; ch_ind++) {
		let y = (ch_ind + 0.5) * channel_height;
		let channel = audio.buffer.getChannelData(ch_ind);
		ctx.moveTo(0, y);

		for (let i = 0; i < total_samples; i++) {
			let vol = Math.clamp(channel[i * sample_step], -0.98, 0.98);
			ctx.lineTo(i * sample_width, y + vol * channel_height * 0.45);
		}
	}

	ctx.stroke();

	if (!audio.buffer) {
		return;
	}

	sample_width = 8;
	total_samples = audio.canvas.width / sample_width;

	let f = new FFT(6);
	let fft_out = f.createComplexArray();
	for (let ch_ind = 0; ch_ind < 1; ch_ind++) {
		let channel = audio.buffer.getChannelData(ch_ind);

		for (let i = 0; i < total_samples; i++) {
			let start = Math.floor(Math.remap(i, 0, total_samples, 0, audio.buffer.length));
			f.realTransform(fft_out, channel.slice(start, start + f.size));

			for (let y  = 0; y < total_height; y++) {
				let ind = Math.floor(Math.remap(y, 0, total_height, 32, 0)) << 1;

				ctx.fillStyle = `rgb(255,255,255,${Math.hypot(fft_out[ind], fft_out[ind+1]) / 33})`;
				ctx.fillRect(i * sample_width, y, sample_width, 1);
			}
		}
	}
}

/**
@arg {string} formula
@returns {(x: number) => number}
*/
function curve(formula) {
	return eval(`function y(x) {return ${formula}}; y`);
}

/**
@arg {string} formula
@returns {(x: number, t?: number, sI?: number, sC?: number, x0?: number, x2?: number, ch?: number, chC?: number,) => number}
*/
function churn_curve(formula) {
	return eval(`function y(x, t, sI, sC, x0, x2, ch, chC) {return ${formula}}; y`);
}

const curves = {
	"Linear": curve("x"),
	"Sine ease-in": curve("1 - cos((x * PI) / 2)"),
	"Sine ease-out": curve("sin((x * PI) / 2)"),
	"Sine ease-in-out": curve("-(cos(PI * x) - 1) / 2"),
	"Quad ease-in": curve("x * x"),
	"Quad ease-out": curve("1 - (1 - x) * (1 - x)"),
	"Quad ease-in-out": curve("x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2"),
	"Cubic ease-in": curve("x * x * x"),
	"Cubic ease-out": curve("1 - pow(1 - x, 3)"),
	"Cubic ease-in-out": curve("x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2"),
	"Quart ease-in": curve("x * x * x * x"),
	"Quart ease-out": curve("1 - pow(1 - x, 4)"),
	"Quart ease-in-out": curve("x < 0.5 ? 8 * x * x * x * x : 1 - pow(-2 * x + 2, 4) / 2"),
	"Quint ease-in": curve("x * x * x * x * x"),
	"Quint ease-out": curve("1 - pow(1 - x, 5)"),
	"Quint ease-in-out": curve("x < 0.5 ? 16 * x * x * x * x * x : 1 - pow(-2 * x + 2, 5) / 2"),
	"Expo ease-in": curve("x === 0 ? 0 : pow(2, 10 * x - 10)"),
	"Expo ease-out": curve("x === 1 ? 1 : 1 - pow(2, -10 * x)"),
	"Expo ease-in-out": curve("x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? pow(2, 20 * x - 10) / 2  : (2 - pow(2, -20 * x + 10)) / 2"),
	"Circ ease-in": curve("1 - sqrt(1 - pow(x, 2))"),
	"Circ ease-out": curve("sqrt(1 - pow(x - 1, 2))"),
	"Circ ease-in Out": curve("x < 0.5   ? (1 - sqrt(1 - pow(2 * x, 2))) / 2 : (sqrt(1 - pow(-2 * x + 2, 2)) + 1) / 2"),
	"Back ease-in": curve(" 2.70158 * x * x * x - 1.70158 * x * x"),
	"Back ease-out": curve(" 1 + 2.7015 * pow(x - 1, 3) + 1.7015 * pow(x - 1, 2)"),
	"Back ease-in Out": curve("x < 0.5 ? (pow(2 * x, 2) * ((1.70158 * 1.525 + 1) * 2 * x - 1.70158 * 1.525)) / 2 : (pow(2 * x - 2, 2) * ((1.70158 * 1.525 + 1) * (x * 2 - 2) + 1.70158 * 1.525) + 2) / 2"),
	"Elastic ease-in": curve("x === 0 ? 0 : x === 1 ? 1 : -pow(2, 10 * x - 10) * sin((x * 10 - 10.75) * 2 * PI / 3)"),
	"Elastic ease-out": curve("x === 0 ? 0 : x === 1 ? 1 : pow(2, -10 * x) * sin((x * 10 - 0.75) * 2 * PI / 3) + 1"),
	"Elastic ease-in-out": curve("x === 0  ? 0  : x === 1  ? 1  : x < 0.5  ? -(pow(2, 20 * x - 10) * sin((20 * x - 11.125) * (2 * PI) / 4.5)) / 2  : (pow(2, -20 * x + 10) * sin((20 * x - 11.125) * (2 * PI) / 4.5)) / 2 + 1")
};

/** @arg {AudioBuffer} audio_buffer */
function copy_audio_buffer(audio_buffer) {
	let new_buf = new AudioBuffer({
		numberOfChannels: audio_buffer.numberOfChannels,
		length: audio_buffer.length,
		sampleRate: audio_buffer.sampleRate
	});

	for (let i = 0; i < audio_buffer.numberOfChannels; i++) {
		let ch = audio_buffer.getChannelData(i);
		new_buf.copyToChannel(ch, i);
	}

	return new_buf;
}

/** @arg {AudioBuffer} audio_buffer @arg {Float32Array[]} channels */
function copy_audio_buffer_with_channels(audio_buffer, channels) {
	let len = channels[0].length;

	let new_buf = new AudioBuffer({
		numberOfChannels: channels.length,
		length: len,
		sampleRate: audio_buffer.sampleRate
	});

	for (let i = 0; i < channels.length; i++) {
		new_buf.copyToChannel(channels[i], i);
	}

	return new_buf;
}

/** @arg {Filter<any>} filter @arg {string} filter_name*/
function filter_container(filter, filter_name) {
	/** @type {HTMLDivElement} */
	let container;
	/** @type {Knob} */
	let mix_knob_el;
	/** @type {Knob} */
	let fft_q_el;

	return (container =
		el('div')
		.then(el => {
			el.store.filter = filter;
			el.store.filter_name = filter_name;
			filter.container = el;
		})
		.set_class('filter-container', 'dent')
		.set_props({id: inc_id() + ""})
		.allow_dropping("filters", (ev) => {
			let other_container_id = ev.dataTransfer.getData('text/container_id');

			if (container.id === other_container_id) {
				return;
			}

			let other_container = document.getElementById(other_container_id);
			let other_filter = other_container.store.filter;

			if (other_container.nextElementSibling === container || other_container === container.nextElementSibling) {
				let ind_1 = pipeline.indexOf(filter);
				let ind_2 = pipeline.indexOf(other_filter);

				[pipeline[ind_1], pipeline[ind_2]] = [pipeline[ind_2], pipeline[ind_1]];
				swap_elements(container, other_container);
				return;
			} else {
				let other_ind = pipeline.indexOf(other_filter);

				pipeline.splice(other_ind, 1);

				let ind = pipeline.indexOf(container.store.filter);
				pipeline.splice(ind, 0, other_filter);

				container.append_before(other_container);
			}

			invalidate_filter_cache(other_filter);
			apply_pipeline();
		})
		.append(
			el('div')
			.set_class('filter-title')
			.set_props({draggable: true})
			.allow_dragging("filters", () => ({
				'text/container_id': container.id
			}))
			.append(
				el('input')
				.set_props({type: 'checkbox', checked: filter.enabled})
				.on('input', () => {
					filter.enabled = !filter.enabled;
					container.classList.toggle('disabled', !filter.enabled);
					invalidate_filter_cache(filter);
					apply_pipeline();
				}),

				text(filter_name),

				el('div')
				.set_class('flex-space')
				.set_style({"--min-width": "16px", "--flex-max": 4}),

				mix_knob_el = knob(filter.mix_factor, 16, 0, 1, 'x')
				.set_props({label: (() => {
					switch (filter.type) {
						case 'generator':
							return 'VOL';
						default:
							return 'MIX';
					}
				})()})
				.on('input', () => {
					filter.mix_factor = mix_knob_el.value;
					invalidate_filter_cache(filter);
					apply_pipeline();
				}),

				fft_q_el = filter.type === "fft" ? (
					knob(filter.fft_power, 16, 1, 16, '')
					.set_props({label: "FFT", integer: true, step_count: 16})
					.on('input', () => {
						filter.fft_power = fft_q_el.value;
						invalidate_filter_cache(filter);
						apply_pipeline();
					})
				) : null,

				el('div')
				.set_class('flex-space')
				.set_style({"--min-width": "8px", "--flex-max": 1}),

				button('', () => {
					container.toggle_class('collapsed')
				}).set_class('yellow', 'round'),

				button('', () => {
					container.remove();
					let ind = pipeline.indexOf(filter);
					if (ind != -1) {
						invalidate_filter_cache(filter);
						pipeline.splice(ind, 1);
						apply_pipeline();
					}
				}).set_class('red', 'round')
				),

			el('div')
			.set_class('filter-body')
			.append(
				filter.display(filter)
			)
			)
		);
}

window.array_get = function (arr, index) {
	if (index > arr.length - 1) {
		return arr[arr.length-1];
	} else if (index < 0) {
		return arr[0];
	}

	return arr[index];
}

window.create_filter = function(filter) {
	return filter;
}

const filters = {
	"Passthrough": create_filter({
		type: 'buffer',
		fn: copy_audio_buffer,
		display: () => {
			let text = document.createTextNode("Passthrough...");
			let div = document.createElement("div");
			div.appendChild(text);
			return div;
		}
	}),
	"Passthrough FFT": create_filter({
		type: 'fft',
		fft_power: 9,
		fn: (fft) => {
			return fft;
		},
		display: () => {
			let text = document.createTextNode("Passthrough FFT...");
			let div = document.createElement("div");
			div.appendChild(text);
			return div;
		}
	}),
	"Multiply": create_filter({
		type: 'sample',
		fn: (sample, settings) => {
			return sample.volume * settings.factor;
		},
		settings: {
			factor: 1
		},
		display: (filter) => {
			return (
				el('div')
				.append(
					filter_bind(
						filter, 'factor',
						el('input')
						.set_props({
							type: 'number',
							valueAsNumber: filter.settings.factor
						})
					)
				)
			);
		}
	}),
	"Hi pass": create_filter({
		type: 'fft',
		fft_power: 9,
		before_processing: function (settings) {
			settings.half_knee = settings.knee_width / 2;
		},
		fn: function (fft, fft_res, settings) {
			let len = fft.length;
			let half_knee = settings.half_knee;

			for (let i = 0; i < len - 1; i += 2) {
				let freq = fft_freq(i, fft_res);

				if (freq <= settings.hz - half_knee) {
					fft[i] = fft[i] * settings.factor;
					fft[i+1] = fft[i+1] * settings.factor;
				} else if (freq <= settings.hz + half_knee) {
					fft[i] = Math.remap(freq, settings.hz - half_knee, settings.hz + half_knee, fft[i] * settings.factor, fft[i]);
					fft[i + 1] = Math.remap(freq, settings.hz - half_knee, settings.hz + half_knee, fft[i + 1] * settings.factor, fft[i + 1]);
				} else {
					// When we get above the cutoff freq + knee width, we don't have to process any more.
					break;
				}
			}

			return fft;
		},
		settings: {
			hz: 2000,
			factor: 1,
			knee_width: 200,
			half_knee: 100
		},
		display: (filter) => {
			return (
				el('div')
				.append(
					filter_bind(
						filter, 'hz',
						knob(filter.settings.hz, 32, 0, 22000, 'hz')
						.set_props({"logscale": true})
					),
					filter_bind(
						filter, 'factor',
						knob(filter.settings.factor, 32, -10, 10, 'x')
					),
					filter_bind(
						filter, 'knee_width',
						knob(filter.settings.knee_width, 32, 0, 2000, 'hz')
						.set_props({"logscale": true})
					)
				)
			);
		}
	}),
	"Sweeper": create_filter({
		type: 'generator',
		settings: {
			frequency: 440,
			end_frequency: 880,
			ease: 'Linear',
			duration: 2,
			channels: 2
		},
		fn: function (sample_period, volume, settings) {
			const samples = Math.round(settings.duration/sample_period);
			const omega1 = Math.PI * 2 * settings.frequency;
			const omega2 = Math.PI * 2 * settings.end_frequency;
			const fn = curves[settings.ease];
			let out = new Array(samples);

			for (let i = 0; i < samples; i++) {
				let curv = fn(Math.remap(i, 0, samples, 0, 1));
				out[i] = Math.sin(Math.lerp(omega1, omega2, curv) * i * sample_period) * volume;
			}

			let channels = new Array(settings.channels);
			for (let i = 0; i < settings.channels; i++) {
				channels[i] = Array.from(out);
			}

			return channels;
		},
		display: (filter) => {
			return (
				column(
					row(
						filter_bind(
							filter, 'frequency',
							knob(filter.settings.frequency, 32, 0.01, 22000, 'hz')
							.set_props({"logscale": true, "label": "F1"})
							),

						filter_bind(
							filter, 'end_frequency',
							knob(filter.settings.end_frequency, 32, 0.01, 22000, 'hz')
							.set_props({"logscale": true, "label": "F2"})
							),
					),

					row(
						filter_bind(
							filter, 'ease',
							el('select').append(
								...Object.keys(curves).map(name => el("option").set_props({
									value: name,
									innerText: name
								}))
							)
						)
					),

					row(
						filter_bind(
							filter, 'duration',
							knob(filter.settings.duration, 32, 0.1, 10, 's')
							.set_props({"label": "SECS"})
							),

						filter_bind(
							filter, 'channels',
							knob(filter.settings.channels, 32, 1, 4, '')
							.set_props({
								integer: true,
								step_count: 4,
								label: "CH",
								value_format: (val) => (val | 0) + ""
							})
							)
						)
					)
				);
		}

	}),

	"Churn": create_filter({
		type: 'sample',

		settings: {
			churn_text: "x",
			churn_fn: churn_curve("x"),
			churn_err: false
		},

		before_processing: (settings) => {
			try {
				settings.churn_fn = churn_curve(settings.churn_text);
				settings.churn_fn(1, 2, 3, 4, 5);
				settings.churn_err = false;
			} catch {
				settings.churn_fn = null;
				settings.churn_err = true;
			}
		},

		fn: function (sample, settings) {
			if (settings.churn_fn) {
				return settings.churn_fn(
					sample.volume, sample.progress, sample.index, sample.count,
					sample.volume_previous, sample.volume_next, sample.channel_index,
					sample.channel_count
				);
			} else {
				return sample.volume;
			}
		},

		display: (filter) => {
			return (
				column(
					filter_bind(
						filter, 'churn_text',
						el('textarea')
						.set_style({resize: 'none', flex: 1})
						.interval((el) => {
							if (filter.settings.churn_err) {
								el.set_class('red');
							} else {
								el.remove_class('red');
							}
						}, 250)
					),
				)
			);
		}

	}),

	"Crescendo": create_filter({
		type: 'sample',
		settings: {
			start_volume: 1,
			end_volume: 0,
			ease: 'Linear',
			ease_fn: curves.Linear
		},
		before_processing: (settings) => {
			settings.ease_fn = curves[settings.ease];
		},
		fn: function (sample, settings) {
			return Math.lerp(settings.start_volume, settings.end_volume, settings.ease_fn(sample.progress)) * sample.volume;
		},
		display: (filter) => {
			return (
				column(
					row(
						filter_bind(
							filter, 'start_volume',
							knob(filter.settings.start_volume, 32, -10, 10, 'x')
							.set_props({"label": "V1"})
						),

						filter_bind(
							filter, 'end_volume',
							knob(filter.settings.end_volume, 32, -10, 10, 'x')
							.set_props({"label": "V2"})
						),
					),

					row(
						filter_bind(
							filter, 'ease',
							el('select').append(
								...Object.keys(curves).map(name => el("option").set_props({
									value: name,
									innerText: name
								}))
							)
						)
					)
				)
			);
		}

	}),

	"Low pass": create_filter({
		type: 'fft',
		fft_power: 9,
		fn: (fft, fft_res, settings) => {
			let len = fft.length;
			for (let i = 0; i < len; i++) {
				let freq = fft_freq(i, fft_res);

				if (freq >= settings.hz) {
					fft[i] = fft[i] * settings.factor;
				}
			}

			return fft;
		},
		settings: {
			hz: 200,
			factor: 1
		},
		display: (filter) => {
			return (
				el('div')
				.append(
					filter_bind(
						filter, "hz",
						knob(filter.settings.hz, 32, 0, 22000, 'hz')
						.set_props({logscale: true, label: 'FREQ'})
					),
					filter_bind(
						filter, "factor",
						knob(filter.settings.factor, 32, -10, 10, 'x')
						.set_props({label: 'FACTOR'})
					)
				)
			);
		}
	})
};

window.fft_resolution = function (sample_rate, fft_len) {
	return sample_rate / fft_len;
}

window.fft_freq = function (fft_index, fft_resolution) {
	return ((fft_index / 2) | 0) * fft_resolution;
}

window.filter_cache_string = function (filter) {
	let cache_object = shallow_copy(filter);
	cache_object.cache_buffer = null;
	cache_object.cache_string = null;
	cache_object.container = null;
	return JSON.stringify(cache_object);
}

window.update_filter_cache = function(filter, buffer) {
	filter.cache_string = filter_cache_string(filter);
	filter.cache_buffer = buffer;
	return buffer;
}

window.invalidate_filter_cache = function(inv_filter) {
	let passed = false;
	for (let filter of pipeline) {
		if (filter === inv_filter) {
			passed = true;
		}

		if (passed) {
			filter.cache_buffer = null;
			filter.cache_string = null;
		}
	}
}

/**
@arg {AudioBuffer} input_buffer
@arg {SampleFilter<any>} filter
@arg {number} job_id
*/
function* run_sample_filter(input_buffer, filter, job_id) {
	const settings = filter.settings;
	const mix_factor = filter.mix_factor;

	let running = true;
	let kill_signal = job_kill_signal.subscribe((id) => {

		if (id === job_id) {
			running = false;
			return Signal.UNSUB;
		}

		return undefined;
	}, true);

	const fn = filter.fn;
	const len = input_buffer.length;
	const inv_len = 1 / len;

	let out_channels = [];
	let length = 0;

	let ch_num = input_buffer.numberOfChannels;
	let inv_total_work = 1 / (len * ch_num);

	/** @type {SampleData} */
	let sample = {
		volume: NaN,
		volume_next: NaN,
		volume_previous: NaN,
		progress: NaN,
		index: NaN,
		count: len,
		channel_index: NaN,
		channel_count: ch_num,
	};

	for (let ch_ind = 0; ch_ind < ch_num; ch_ind++) {
		let in_channel = input_buffer.getChannelData(ch_ind);
		let out_channel = [];

		sample.channel_index = ch_ind;

		for (let i = 0; i < len; i++) {
			let original = in_channel[i];

			sample.volume = original;
			sample.volume_next = in_channel[i + 1] || 0;
			sample.volume_previous = in_channel[i - 1] || 0;
			sample.progress = i * inv_len;
			sample.index = i;

			let volume = fn(sample, settings);

			if (i  % 100 === 99) {
				if (!running) return JOB_KILLED;
				yield (i + len * ch_ind) * inv_total_work;
			}

			if (volume === undefined || volume === null) {
				continue;
			} else if (typeof(volume) === 'number') {
				volume = volume * mix_factor + original * (1 - mix_factor);
				out_channel.push(volume);
			} else {
				out_channel.push(...volume);
			}
		}

		length = Math.max(length, out_channel.length);
		out_channels.push(out_channel);

		if (!running) return JOB_KILLED;
		yield (len * (ch_ind + 1)) * inv_total_work;
	}

	let out_f32_channels = [];
	for (let ch of out_channels) {
		while (ch.length < length) {
			ch.push(0);
		}
		out_f32_channels.push(new Float32Array(ch));
	}

	kill_signal.unsubscribe();
	return copy_audio_buffer_with_channels(input_buffer, out_f32_channels);
}

/**
@arg {AudioBuffer} input_buffer
@arg {FFTFilter<any>} filter
@arg {number} job_id
*/
function* run_fft_filter(input_buffer, filter, job_id) {
	const settings = filter.settings;
	const mix_factor = filter.mix_factor;
	const inv_mix_factor = 1 - mix_factor;

	let running = true;
	let kill_signal = job_kill_signal.subscribe((id) => {
		if (id === job_id) {
			running = false;
			return Signal.UNSUB;
		}

		return undefined;
	});

	const fn = filter.fn;

	const f = new FFT(filter.fft_power);
	let fft_len = 2 ** filter.fft_power;

	let fft_in = new Float32Array(fft_len);
	let fft_to_process = f.createComplexArray();
	let fft_out = f.createComplexArray();

	let len = input_buffer.length;
	let fft_res = fft_resolution(input_buffer.sampleRate, f.size);
	let out_channels = [];

	let ch_num = input_buffer.numberOfChannels;
	let inv_total_work = 1 / (len * ch_num);

	let fft_window_step = fft_len;

	for (let ch_ind = 0; ch_ind < input_buffer.numberOfChannels; ch_ind++) {
		let in_channel = input_buffer.getChannelData(ch_ind);
		let out_channel = new Float32Array(len);

		for (let i = 0; i < len; i += fft_window_step) {
			if (i + fft_len < len) {
				fft_in.set(in_channel.slice(i, i + fft_len));
			} else {
				fft_in.fill(0);
				fft_in.set(in_channel.slice(i, len));
			}

			f.realTransform(fft_to_process, fft_in);
			f.inverseTransform(fft_out, fn(fft_to_process, fft_res, settings));

			for (let j = 0; j < fft_len && i + j < len; j++) {
				let vol = fft_out[j*2];
				out_channel[i + j] = vol * mix_factor + in_channel[i + j] * inv_mix_factor;
			}

			if (!running) return JOB_KILLED;
			if (i % 100 === 99) {
				yield (i + len * ch_ind) * inv_total_work;
			}
		}

		if (!running) return JOB_KILLED;
		yield (len * (ch_ind + 1)) * inv_total_work;
		out_channels.push(out_channel);
	}

	kill_signal.unsubscribe();
	return copy_audio_buffer_with_channels(input_buffer, out_channels);
}


/**
@arg {AudioBuffer} input_buffer
@arg {BufferFilter<any>} filter
@arg {number} job_id
*/
function* run_buffer_filter(input_buffer, filter, job_id) {
	// @TODO: Maybe make buffer filter functions be generators?
	return filter.fn(input_buffer, filter);
}

/**
@arg {AudioBuffer} input_buffer
@arg {GeneratorFilter<any>} filter
@arg {number} job_id
*/
function* run_generator_filter(input_buffer, filter, job_id) {
	let output_channels = filter.fn(1 / (input_buffer ? input_buffer.sampleRate : 44100), filter.mix_factor, filter.settings);

	let len = 0;
	for (let ch of output_channels) {
		len = Math.max(len, ch.length);
	}

	let buffer = input_buffer || new AudioBuffer({sampleRate: 44100, numberOfChannels: output_channels.length, length: output_channels[0].length});

	for (let ch of output_channels) {
		while (ch.length < len) {
			ch.push(0);
		}
	}

	let out_f32_channels = [];

	for (let ch of output_channels) {
		out_f32_channels.push(new Float32Array(ch));
	}

	return update_filter_cache(
		filter, copy_audio_buffer_with_channels(buffer, out_f32_channels)
	);
}

/**
@arg {AudioBuffer | null} input_buffer
@arg {Filter<any>} filter
@returns {Promise<AudioBuffer | Symbol | null>}
*/
async function run_filter(input_buffer, filter) {
	return new Promise(resolve => {
		if (!input_buffer && filter.type != 'generator') {
			resolve(null);
			return;
		}

		if (!filter.enabled) {
			resolve(input_buffer);
			return;
		}

		if (filter.before_processing) {
			filter.before_processing(filter.settings);
		}

		if (filter.mix_factor === 0) {
			resolve(input_buffer);
			return;
		}

		if (filter.cache_string && filter.cache_buffer) {
			if (filter.cache_string === filter_cache_string(filter)) {
				resolve(filter.cache_buffer);
				return;
			}
		}

		let run_func = filter.type === "sample" ? run_sample_filter :
						filter.type === "fft" ? run_fft_filter :
						filter.type === "generator" ? run_generator_filter :
						filter.type === "buffer" ? run_buffer_filter : null;

		job_kill_signal.emit(latest_filter_job);
		latest_filter_job = inc_id();
		let gen = run_func(input_buffer, (/** @type {any} */(filter)), latest_filter_job);
		let res = gen.next();

		let interval = setInterval(() => {
			let done = res.done;

			let t1 = performance.now();
			while (!done) {
				res = gen.next();
				done = res.done;

				if (performance.now() - t1 > 16) {
					break;
				}
			}

			if (done) {
				if (res.value !== JOB_KILLED && res.value !== null) {
					update_filter_cache(filter, (/** @type {AudioBuffer} */(res.value)));
					resolve(/** @type {any} */(res.value));
				} else {
					resolve(JOB_KILLED);
				}

				clearInterval(interval);
			}
		}, 0);
	});
}

window.apply_pipeline = async function apply_pipeline() {
	return new Promise(async (resolve) => {
		let output_buffer = input.buffer;

		for (let filter of pipeline) {
			let res = await run_filter(output_buffer, filter);

			if (res === JOB_KILLED) {
				resolve();
				return;
			}

			output_buffer = (/** @type {AudioBuffer} */(res));
		}

		output.buffer = output_buffer;
		set_source(output);
		render_audio(output);

		resolve();
	});
}