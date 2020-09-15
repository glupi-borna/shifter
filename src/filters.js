window.curve = function curve(formula) {
	return eval(`function y(x) {return ${formula}}; y`);
}

window.params_curve = function params_curve(param_no, formula) {
	let params_str = "";

	for (let i = 0; i < param_no; i++) {
		params_str += "p" + i;

		if (i !== param_no) {
			params_str += ", "
		}
	}

	return eval(`function y(${params_str}) {return ${formula}}; y`)
}

window.churn_curve = function churn_curve(formula) {
	return eval(`function y(x, t, p, freq, period, ind, len, invlen, buf, ch, chind, chnum) {return ${formula}}; y`);
}

const shapes = {
	"Sine": (rad, phase) => Math.sin(rad + phase),
	"Saw": function (x, phase) {
		let base = (x + phase + Math.PI);
		let repeating = base % (Math.PI * 2);
		let saw = repeating / Math.PI - 1;
		return saw;
	},
	"Triangle": function (x, phase) {
		let base = (x + phase + Math.PI / 2);
		let repeating = base % (Math.PI * 2);
		let normalized = Math.abs(repeating / Math.PI - 1);
		return 1 - 2 * normalized;
	},
	"Square": (x, phase) => ((x + phase) % (Math.PI * 2)) > Math.PI ? -1 : 1
};

const curves = {
	"Fixed": params_curve(2, "p1"),
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
	"Circ ease-in-out": curve("x < 0.5   ? (1 - sqrt(1 - pow(2 * x, 2))) / 2 : (sqrt(1 - pow(-2 * x + 2, 2)) + 1) / 2"),
	"Back ease-in": curve(" 2.70158 * x * x * x - 1.70158 * x * x"),
	"Back ease-out": curve(" 1 + 2.7015 * pow(x - 1, 3) + 1.7015 * pow(x - 1, 2)"),
	"Back ease-in-out": curve("x < 0.5 ? (pow(2 * x, 2) * ((1.70158 * 1.525 + 1) * 2 * x - 1.70158 * 1.525)) / 2 : (pow(2 * x - 2, 2) * ((1.70158 * 1.525 + 1) * (x * 2 - 2) + 1.70158 * 1.525) + 2) / 2"),
	"Elastic ease-in": curve("x === 0 ? 0 : x === 1 ? 1 : -pow(2, 10 * x - 10) * sin((x * 10 - 10.75) * 2 * PI / 3)"),
	"Elastic ease-out": curve("x === 0 ? 0 : x === 1 ? 1 : pow(2, -10 * x) * sin((x * 10 - 0.75) * 2 * PI / 3) + 1"),
	"Elastic ease-in-out": curve("x === 0  ? 0  : x === 1  ? 1  : x < 0.5  ? -(pow(2, 20 * x - 10) * sin((20 * x - 11.125) * (2 * PI) / 4.5)) / 2  : (pow(2, -20 * x + 10) * sin((20 * x - 11.125) * (2 * PI) / 4.5)) / 2 + 1")
};

window.filter_pipeline = [];

window.filter_container = function filter_container(filter, filter_name) {
	/** @type {HTMLDivElement} */
	let container;
	/** @type {Knob} */
	let mix_knob_el;
	/** @type {Knob} */
	let fft_q_el;
	/** @type {Knob} */
	let gen_ch_el;
	/** @type {Knob} */
	let gen_len_el;
	/** @type {HTMLButtonElement} */
	let mode_button;


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
				let ind_1 = filter_pipeline.indexOf(filter);
				let ind_2 = filter_pipeline.indexOf(other_filter);

				[filter_pipeline[ind_1], filter_pipeline[ind_2]] = [filter_pipeline[ind_2], filter_pipeline[ind_1]];
				swap_elements(container, other_container);
				return;
			} else {
				let other_ind = filter_pipeline.indexOf(other_filter);

				filter_pipeline.splice(other_ind, 1);

				let ind = filter_pipeline.indexOf(container.store.filter);
				filter_pipeline.splice(ind, 0, other_filter);

				container.append_before(other_container);
			}

			filter_invalidate_cache(other_filter);
			filter_apply_pipeline();
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
					filter_invalidate_cache(filter);
					filter_apply_pipeline();
				}),

				text(filter_name),

				space(16, 4),

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
					filter_invalidate_cache(filter);
					filter_apply_pipeline();
				}),

				fft_q_el = filter.type === "fft" ? (
					knob(filter.fft_power, 16, 1, 16, '')
					.set_props({label: "FFT", integer: true})
					.on('input', () => {
						filter.fft_power = fft_q_el.value;
						filter_invalidate_cache(filter);
						filter_apply_pipeline();
					})
				) : null,

				space(8),

				...(filter.type != "generator" ? [
					mode_button = button(filter.mode === "add" ? "+" : "⨯\uFE0E", () => {
						select_popover(mode_button, {
							Multiply: "multiply",
							Add: "add"
						}).then(res => {
							if (res === "add" || res === "multiply") {
								filter.mode = res;
								mode_button.innerText = res === "add" ? "+" : "⨯\uFE0E";
							}
						})
					}).set_style({
						width: "16px",
						height: "16px",
						"line-height": "16px",
						"font-size": "16px",
						margin: 0,
						padding: 0
					}),

					space(8),


					column(
						...new Array(2)
						.fill(null)
						.map((_, col) => {
							return row(
								...new Array(3)
								.fill(null)
								.map((_, row) => {
									return el("input").
									set_props({type: "checkbox", checked: true}).
									set_class("channel-nub").
									then((el) => {
										filter.cache_invalidated.subscribe(() => {
											el.checked = filter.target_channels[row + col * 3];
										});
									}).
									on("contextmenu", (ev) => {
										ev.preventDefault();
										let val = filter.target_channels[row + col * 3];

										for (let j = 0; j < 6; j++) {
											filter.target_channels[j] = val;
										}

										filter.target_channels[row + col * 3] = !val;

										filter_invalidate_cache(filter);
										filter_apply_pipeline();
									}).
									on("click", _ => {
										filter.target_channels[row + col * 3] = !filter.target_channels[row + col * 3];
										filter_invalidate_cache(filter);
										filter_apply_pipeline();
									})
								})
							)
						})
					)
					.set_style({height: "auto"}),

					space(8)
				]: [
					gen_len_el = knob(filter.duration, 16, 0.05, 10, 's')
					.set_props({label: "T"})
					.on('input', () => {
						filter.duration = gen_len_el.value;
						filter_invalidate_cache(filter);
						filter_apply_pipeline();
					}),
					gen_ch_el = knob(filter.channels, 16, 1, 6, '')
					.set_props({label: "CH", integer: true})
					.on('input', () => {
						filter.channels = gen_ch_el.value;
						filter_invalidate_cache(filter);
						filter_apply_pipeline();
					})
				]),

				button('', () => {
					container.toggle_class('collapsed')
				}).set_class('yellow', 'round'),

				button('', () => {
					container.remove();
					let ind = filter_pipeline.indexOf(filter);
					if (ind != -1) {
						filter.cache_invalidated.end();
						filter_invalidate_cache(filter);
						filter_pipeline.splice(ind, 1);
						filter_apply_pipeline();
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

window.filter_create = function(filter) {
	return filter;
}

window.filters = {
	"Silence": filter_create({
		type: "generator",
		fn: () => {
			return 0;
		},
		display: () => {
			return column(
				el("span").append(text("Silence"))
			).set_style({
				"width": "100%",
				"justify-content": "center",
				"align-items": "center",
			});
		}
	}),
	"Multiply": filter_create({
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
	"Hi pass": filter_create({
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
						knob(filter.settings.hz, 32, 0, 22000, 'hz', true)
					),
					filter_bind(
						filter, 'factor',
						knob(filter.settings.factor, 32, -10, 10, 'x', false)
					),
					filter_bind(
						filter, 'knee_width',
						knob(filter.settings.knee_width, 32, 0, 2000, 'hz', true)
					),

				)
			);
		}
	}),

	"Sweeper": filter_create({
		type: 'sample',
		settings: {
			start_freq: 440,
			start_omega: 0,
			start_vol: 1,
			start_shape: shapes["Sine"],
			start_shape_param: 0,

			end_freq: 440,
			end_omega: 0,
			end_vol: 1,
			end_shape: shapes["Sine"],
			end_shape_param: 0,

			freq_ease: curves["Linear"],
			freq_ease_param: 0,
			vol_ease: curves["Linear"],
			vol_ease_param: 0,
			shape_ease: curves["Linear"],
			shape_ease_param: 0,

			link: false
		},
		before_processing: (settings) => {
			if (settings.link) {
				settings.end_freq = settings.start_freq;
				settings.end_omega = settings.start_omega;
				settings.end_vol = settings.start_vol;
				settings.end_shape_param = settings.start_shape_param;
				settings.end_shape = settings.start_shape;
			}

			settings.start_omega = Math.PI * 2 * settings.start_freq;
			settings.end_omega = Math.PI * 2 * settings.end_freq;
		},
		fn: function (sample_data, settings) {
			const freq_ease = settings.freq_ease;
			const freq_ease_param = settings.freq_ease_param;

			const vol_ease = settings.vol_ease;
			const vol_ease_param = settings.vol_ease_param;

			const shape_ease = settings.shape_ease;
			const shape_ease_param = settings.shape_ease_param;

			const start_omega = settings.start_omega;
			const start_vol = settings.start_vol;
			const start_shape = settings.start_shape;
			const start_shape_param = settings.start_shape_param;

			const end_omega = settings.end_omega;
			const end_vol = settings.end_vol;
			const end_shape = settings.end_shape;
			const end_shape_param = settings.end_shape_param;

			let omega_curve = freq_ease(sample_data.progress, freq_ease_param);
			let vol_curve   = vol_ease(sample_data.progress, vol_ease_param);
			let shape_curve = shape_ease(sample_data.progress, shape_ease_param);

			let omega = Math.lerp(start_omega, end_omega, omega_curve) * sample_data.time;
			let vol = Math.lerp(start_vol, end_vol, vol_curve);

			let shape = Math.lerp(
				start_shape(omega, start_shape_param),
				end_shape(omega, end_shape_param),
				shape_curve
			);

			return shape * vol;
		},
		display: (filter) => {
			let start_signal_knob = column(
				row(
					filter_bind(
						filter, 'start_freq',
						knob(filter.settings.start_freq, 32, 0.01, 22050, 'hz', true)
						.set_props({"label": "F1"})
					),

					filter_bind(
						filter, 'start_vol',
						knob(filter.settings.start_vol, 16, -10, 10, "")
						.set_props({"label": "V1"})
					)
				).set_style({"justify-content": "center"}),

				row(
					filter_bind(filter, "start_shape", select(shapes, "Sine")),

					filter_bind(filter, "start_shape_param",
						knob(filter.settings.start_shape_param, 16, -Math.PI, Math.PI, "°")
						.set_props({
							label: "𝝋",
							value_format: (val) => (val * 180 / Math.PI).toFixed(2).replace(/(\.0+$)/, "")
						})
					)
				)
			);

			let link_checkbox = [
				column(
					filter_bind(filter, 'link',
						el('input')
						.set_props({type: 'checkbox', checked: filter.settings.link})
					),

					el("span").append(text("LINK"))
				).set_style({"justify-content": "center"})
			];

			let end_signal_knob = column(
				row(
					filter_bind(
						filter, 'end_freq',
						knob(filter.settings.end_freq, 32, 0.01, 22050, 'hz', true)
						.set_props({"label": "F1"})
					),

					filter_bind(
						filter, 'end_vol',
						knob(filter.settings.end_vol, 16, -10, 10)
						.set_props({"label": "V1"})
					)
				).set_style({"justify-content": "center"}),

				row(
					filter_bind(filter, "end_shape", select(shapes, "Sine")),

					filter_bind(filter, "end_shape_param",
						knob(filter.settings.end_shape_param, 16, -Math.PI, Math.PI, "°")
						.set_props({
							label: "𝝋",
							value_format: (val) => (val * 180 / Math.PI).toFixed(2).replace(/(\.0+$)/, "")
						})
					)
				)
			);

			let freq_ease = row(
				el("div").append(text("𝘧")).set_style({
					"width": "24px",
					"font-size": "20px",
					"text-align": "center"
				}),
				filter_bind(filter, 'freq_ease', select(curves, "Linear")),
				filter_bind(filter, "freq_ease_param",
					knob(filter.settings.freq_ease_param, 16, 0, 1, "P")
				)
			);

			let vol_ease = row(
				el("div").append(text("🔊\uFE0E")).set_style({
					"width": "24px",
					"font-size": "20px",
					"text-align": "center"
				}),
				filter_bind(filter, 'vol_ease', select(curves, "Linear")),
				filter_bind(filter, "vol_ease_param",
					knob(filter.settings.vol_ease_param, 16, 0, 1, "P")
				)
			);


			let shape_ease = row(
				el("div").append(text("∿")).set_style({
					"width": "24px",
					"font-size": "20px",
					"text-align": "center"
				}),
				filter_bind(filter, 'shape_ease', select(curves, "Linear")),
				filter_bind(filter, "shape_ease_param",
					knob(filter.settings.shape_ease_param, 16, 0, 1, "P")
				)
			);

			return (
				column(
					row(
						start_signal_knob,
						space(8),
						...link_checkbox,
						space(8),
						end_signal_knob
					),

					space(),

					freq_ease,
					vol_ease,
					shape_ease,
				)
			);
		}

	}),

	"Churn": filter_create({
		type: 'sample',

		settings: {
			churn_text: "x",
			churn_fn: churn_curve("x"),
			churn_err: false,
			churn_hint_el: null
		},

		before_processing: (settings) => {
			try {
				settings.churn_fn = churn_curve(settings.churn_text);
				settings.churn_fn(1, 2, 3, 4, 5, 6, 7, 8, null, null, 0, 1);
				settings.churn_err = false;
				settings.churn_hint_el.set_style({
					"--hint": ""
				});
			} catch (e) {
				settings.churn_fn = (x) => x;
				settings.churn_err = true;
				settings.churn_hint_el.set_style({
					"--hint": `"${e.toString()}"`
				});
			}
		},

		fn: function (sample, settings) {
			if (settings.churn_fn) {
				return settings.churn_fn(
					sample.volume, sample.time, sample.progress, sample.sample_rate,
					sample.sample_period, sample.sample_index, sample.sample_count,
					sample.sample_count_inv, sample.buffer, sample.channel_data,
					sample.channel_index, sample.channel_count
				);
			} else {
				return sample.volume;
			}
		},

		display: (filter) => {
			return (
				column(
					filter.settings.churn_hint_el = el("div").set_class("red", "hint"),
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

	"Crescendo": filter_create({
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

	"Low pass": filter_create({
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
						knob(filter.settings.hz, 32, 0, 22000, 'hz', true)
						.set_props({label: 'FREQ'})
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

window.filter_get_cache_string = function (filter) {
	let cache_object = shallow_copy(filter);
	cache_object.cache_buffer = null;
	cache_object.cache_string = null;
	cache_object.container = null;
	cache_object.cache_invalidated = null;
	return JSON.stringify(cache_object);
}

window.filter_update_cache = function(filter, buffer) {
	filter.cache_string = filter_get_cache_string(filter);
	filter.cache_buffer = buffer;
	return buffer;
}

window.filter_invalidate_cache = function(inv_filter) {
	let passed = false;
	for (let filter of filter_pipeline) {
		if (filter === inv_filter) {
			passed = true;
		}

		if (passed) {
			filter.cache_buffer = null;
			filter.cache_string = null;
			filter.cache_invalidated.emit();
		}
	}
}

/**
@arg {AudioBuffer} input_buffer
@arg {SampleFilter<any>} filter
@arg {JobData} job_data
*/
function* filter_run_sample(input_buffer, filter, job_data) {
	const settings = filter.settings;
	const mix_factor = filter.mix_factor;

	const fn = filter.fn;
	const len = input_buffer.length;
	const inv_len = 1 / len;

	let out_channels = [];
	let length = 0;

	let ch_num = input_buffer.numberOfChannels;
	let inv_total_work = 1 / (len * ch_num);

	/** @type {SampleData} */
	let sample = {
		time: NaN,
		volume: NaN,
		progress: NaN,
		sample_rate: input_buffer.sampleRate,
		sample_period: 1 / input_buffer.sampleRate,
		sample_index: NaN,
		sample_count: len,
		sample_count_inv: inv_len,
		buffer: input_buffer,
		channel_data: null,
		channel_index: NaN,
		channel_count: input_buffer.numberOfChannels
	};

	for (let ch_ind = 0; ch_ind < ch_num; ch_ind++) {
		let in_channel = input_buffer.getChannelData(ch_ind);

		if (!filter.target_channels[ch_ind]) {
			out_channels.push(Array.from(in_channel));
			continue;
		}

		let out_channel = [];

		sample.channel_index = ch_ind;
		sample.channel_data = in_channel;

		// @TODO: Mix/Add
		for (let i = 0; i < len; i++) {
			let original = in_channel[i];

			sample.volume = original;
			sample.progress = i * inv_len;
			sample.time = sample.sample_period * i;
			sample.sample_index = i;

			let volume = fn(sample, settings);

			if (i  % 100 === 99) {
				if (!job_data.is_running) return JOB_KILLED;
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

		if (!job_data.is_running) return JOB_KILLED;
		yield (len * (ch_ind + 1)) * inv_total_work;
	}

	let out_f32_channels = [];
	for (let ch of out_channels) {
		while (ch.length < length) {
			ch.push(0);
		}
		out_f32_channels.push(new Float32Array(ch));
	}

	return audio_buffer_copy_with_channels(input_buffer, out_f32_channels);
}

/**
@arg {AudioBuffer} input_buffer
@arg {FFTFilter<any>} filter
@arg {JobData} job_data
*/
function* filter_run_fft(input_buffer, filter, job_data) {
	const settings = filter.settings;
	const mix_factor = filter.mix_factor;
	const inv_mix_factor = 1 - mix_factor;

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

		if (!filter.target_channels[ch_ind]) {
			out_channels.push(in_channel);
			continue;
		}

		let out_channel = new Float32Array(len);

		// @TODO: Mix/Add
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

			if (!job_data.is_running) return JOB_KILLED;
			if (i % 100 === 99) {
				yield (i + len * ch_ind) * inv_total_work;
			}
		}

		if (!job_data.is_running) return JOB_KILLED;
		yield (len * (ch_ind + 1)) * inv_total_work;
		out_channels.push(out_channel);
	}

	return audio_buffer_copy_with_channels(input_buffer, out_channels);
}


/**
@arg {AudioBuffer} input_buffer
@arg {BufferFilter<any>} filter
@arg {JobData} _
*/
function* filter_run_buffer(input_buffer, filter, _) {
	// @TODO: Maybe make buffer filter functions be generators?
	return filter.fn(input_buffer, filter);
}

/**
@arg {AudioBuffer} _
@arg {GeneratorFilter<any>} filter
@arg {JobData} job_data
*/
function* filter_run_generator(_, filter, job_data) {
	let samples = filter.duration * 44100;
	let inv_total_work = 1 / samples * filter.channels;

	let buffer = new AudioBuffer({sampleRate: 44100, numberOfChannels: filter.channels, length: samples});
	let out_channels = [];

	for (let i = 0; i < filter.channels; i++) {
		let channel = buffer.getChannelData(i);

		for (let j = 0; j < samples; j++) {
			channel[j] = filter.fn(filter.settings) * filter.mix_factor;
		}

		out_channels.push(channel);

		if (!job_data.is_running) return JOB_KILLED;
		yield i * samples / inv_total_work;
	}

	return filter_update_cache(filter, audio_buffer_copy_with_channels(buffer, out_channels));
}

window.filter_run = async function filter_run(input_buffer, filter) {
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
			if (filter.cache_string === filter_get_cache_string(filter)) {
				resolve(filter.cache_buffer);
				return;
			}
		}

		let run_func = filter.type === "sample" ? filter_run_sample :
						filter.type === "fft" ? filter_run_fft :
						filter.type === "generator" ? filter_run_generator :
						filter.type === "buffer" ? filter_run_buffer : null;

		let filter_job = job(JOB_FILTER);
		let gen = run_func(input_buffer, /** @type {any} */(filter), filter_job);
		let res = gen.next();
		let done = res.done;

		let interval = setInterval(() => {
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
					filter_update_cache(filter, /** @type {AudioBuffer} */(res.value));
					resolve(/** @type {any} */(res.value));
				} else {
					resolve(JOB_KILLED);
				}

				job_terminate(filter_job);
				clearInterval(interval);
			}
		}, 0);
	});
}

window.filter_apply_pipeline = async function filter_apply_pipeline() {
	return new Promise(async (resolve) => {
		let output_buffer = input.buffer;

		for (let filter of filter_pipeline) {
			let res = await filter_run(output_buffer, filter);

			if (res === JOB_KILLED) {
				resolve();
				return;
			}

			output_buffer = (/** @type {AudioBuffer} */(res));
		}

		output.buffer = output_buffer;
		audio_set_source(output);
		render_audio(output);
		audio_update_data(output);

		resolve();
	});
}