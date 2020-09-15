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


if (process.versions["nw-flavor"] === "sdk")
	watch_stylesheet(pwd + "/style.scss", "mainStyle");

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
		audio_play(input);
	} else if (ev.key === "o") {
		audio_play(output);
	}
}


window.onload = () => {
	fileInput.on('input', () => {
		audio_open_file(fileInput, input.context)
		.then(audio => {
			input.buffer = audio;
			audio_set_source(input);
			audio_update_data(input);
			render_audio(input);
			if (filter_pipeline.length > 0) {
				filter_invalidate_cache(filter_pipeline[0]);
			}
			filter_apply_pipeline();
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

						fs.writeFileSync(path, audio_encode_wav(output));
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

	audio_init_canvas(input, inputCanvas);
	input.button  = inputButton;
	input.button.onclick = audio_play.bind(input.button, input);
	input.data_element = inputData;

	inputFFTButton
	.append(text("𝘧"))
	.on("click", () => {
		input.render_fft = !input.render_fft;
		inputFFTButton.classList.toggle("red", !input.render_fft);
		render_audio(input);
	});

	inputAMPButton
	.append(text("∿"))
	.on("click", () => {
		input.render_amp = !input.render_amp;
		inputAMPButton.classList.toggle("red", !input.render_amp);
		render_audio(input);
	});

	outputFFTButton
	.append(text("𝘧"))
	.on("click", () => {
		output.render_fft = !output.render_fft;
		outputFFTButton.classList.toggle("red", !output.render_fft);
		render_audio(output);
	});

	outputAMPButton
	.append(text("∿"))
	.on("click", () => {
		output.render_amp = !output.render_amp;
		outputAMPButton.classList.toggle("red", !output.render_amp);
		render_audio(output);
	});

	audio_init_canvas(output, outputCanvas);
	output.data_element = outputData;

	render_all();

	output.button = outputButton;
	output.button.onclick = audio_play.bind(output.button, output);

	pipelineContainer.append(
		el('div').set_class('drop-before', 'yellow', 'dent')
		.allow_dropping("filters", (ev) => {
			let container_id = ev.dataTransfer.getData("text/container_id")
			let container = document.getElementById(container_id);
			let filter = container.store.filter;
			let ind = filter_pipeline.indexOf(filter);

			filter_pipeline.splice(ind, 1);
			filter_pipeline.unshift(filter);

			pipelineContainer.firstElementChild.append_after(container);
			filter_invalidate_cache(filter);
			filter_apply_pipeline();
		}),

		el('div').set_class('drop-before', 'yellow', 'dent')
		.allow_dropping("filters", (ev) => {
			let container_id = ev.dataTransfer.getData("text/container_id")
			let container = document.getElementById(container_id);
			let filter = container.store.filter;
			let ind = filter_pipeline.indexOf(filter);

			filter_pipeline.splice(ind, 1);
			filter_pipeline.push(filter);

			pipelineContainer.lastElementChild.append_before(container);
			filter_invalidate_cache(filter);
			filter_apply_pipeline();
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

		filter_pipeline.push(filter);
		pipelineContainer.lastElementChild.append_before(
			filter_container(filter, filterSelectElement.value)
		);
		filter_apply_pipeline();
	};

	filterSelectElement.set_options(filters)
	.on("keydown", (ev) => {
		if (ev.key === "Enter") {
			add_filter();
			ev.preventDefault();
		}
	}).on("prompt_changed", (_) => {
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