import * as FFTLIB from "./fft.js";
window.FFT = FFTLIB.default;

const fs = require("fs");

import "./utils.js";
import "./jobs.js";
import "./elements.js";
import "./filters.js";
import "./rendering.js";
import "./audio.js";

globalize(Math);

const audio_context = new AudioContext();

watch_stylesheet(pwd + "/style.scss", "mainStyle");

window.input = {
	canvas: null,
	amp_canvas: null,
	fft_canvas: null,
	line_canvas: null,
	buffer: null,
	source: null,
	button: null,
	is_playing: false,
	context: audio_context,
	data_element: null
};

window.output = {
	canvas: null,
	amp_canvas: null,
	fft_canvas: null,
	line_canvas: null,
	buffer: null,
	source: null,
	button: null,
	is_playing: false,
	context: audio_context,
	data_element: null
};

window.shift_down = false;
window.alt_down = false;
window.ctrl_down = false;

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


window.update_data = function update_data(audio) {
	if (!audio.buffer) {
		audio.data_element.remove_children();
		return;
	}

	let seconds = audio.buffer.length / audio.buffer.sampleRate;
	let seconds_post = "seconds";

	if (Math.abs(seconds) === 1) {
		seconds_post = "second";
	}

	let channels_post = "channels";
	if (audio.buffer.numberOfChannels === 1) {
		channels_post = "channel";
	}

	audio.data_element.remove_children().append(
		text(`${seconds.toFixed(2)} ${seconds_post} | ${audio.buffer.sampleRate} Hz | ${audio.buffer.length} samples | ${audio.buffer.numberOfChannels} ${channels_post}`)
	);
}

window.onload = () => {
	fileInput.on('input', () => {
		open_audio_file(fileInput, input.context)
		.then(audio => {
			input.buffer = audio;
			set_source(input);
			update_data(input);
			render_audio(input);
			if (pipeline.length > 0) {
				invalidate_filter_cache(pipeline[0]);
			}
			apply_pipeline();
		});
	});

	fileSave.on("click", async () => {
		let res = await select_popover(fileSave, {"Wave": ".wav"});

		if (res) {
			let listener = () => {
				if (fileOutput.value) {
					try {
						let path = fileOutput.value;
						if (!path.endsWith(res)) {
							path += res;
						}

						fs.writeFileSync(path, encode_wav(output));
					} catch (e) {
						console.log("Failed to write file!", e);
					}
				}

				fileOutput.onchange = null;
			};

			fileOutput.onchange = listener;
			fileOutput.accept = res[0];
			fileOutput.click();
		}
	});

	input.canvas = inputCanvas;
	input.fft_canvas  = new OffscreenCanvas(0, 0);
	input.amp_canvas  = new OffscreenCanvas(0, 0);
	input.line_canvas  = new OffscreenCanvas(0, 0);
	input.button  = inputButton;
	input.button.onclick = play_audio.bind(input.button, input);
	input.data_element = inputData;

	output.canvas = outputCanvas;
	output.fft_canvas = new OffscreenCanvas(0, 0);
	output.amp_canvas = new OffscreenCanvas(0, 0);
	output.line_canvas = new OffscreenCanvas(0, 0);
	output.data_element = outputData;

	render_all();

	output.button = outputButton;
	output.button.onclick = play_audio.bind(output.button, output);

	pipelineContainer.append(
		el('div').set_class('drop-before', 'yellow', 'dent')
		.allow_dropping("filters", (ev) => {
			let container_id = ev.dataTransfer.getData("text/container_id")
			let container = document.getElementById(container_id);
			let filter = container.store.filter;
			let ind = pipeline.indexOf(filter);

			pipeline.splice(ind, 1);
			pipeline.unshift(filter);

			pipelineContainer.firstElementChild.append_after(container);
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

			pipelineContainer.lastElementChild.append_before(container);
			invalidate_filter_cache(filter);
			apply_pipeline();
		})
	);

	let add_filter = () => {
		if (!filters[filterSelectElement.value]) {
			return;
		}

		let filter = shallow_copy(filters[filterSelectElement.value]);
		if (filter.settings) {
			filter.settings = shallow_copy(filter.settings);
		}
		filter.enabled = true;
		filter.mix_factor = 1;
		filter.target_channels = new Array(6).fill(true);
		filter.cache_invalidated = new Signal();
		filter.mode = 'multiply';

		if (filter.type === "generator") {
			filter.duration = 2;
			filter.channels = 2;
		}

		pipeline.push(filter);
		pipelineContainer.lastElementChild.append_before(
			filter_container(filter, filterSelectElement.value)
		);
		apply_pipeline();
	};

	filterSelectElement.set_options(filters)
	.on("keydown", (ev) => {
		if (ev.key === "Enter") {
			add_filter();
			ev.preventDefault();
		}
	}).on("prompt_changed", (ev) => {
		add_filter();
	});

	pipelineAddButton.on("click", add_filter);

	render_all();
};
window.onresize = render_all;



window.array_get = function (arr, index) {
	if (index > arr.length - 1) {
		return arr[arr.length-1];
	} else if (index < 0) {
		return arr[0];
	}

	return arr[index];
}