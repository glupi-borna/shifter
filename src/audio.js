const wav = require("node-wav");
const fs = require("fs");

const audio_context = new AudioContext();

window.audio_init = function audio_init() {
	return {
		canvas: null,
		render_amp: true,
		render_fft: true,
		offscreen_canvas_map: new Map(),

		buffer: null,
		source: null,
		button: null,
		is_playing: false,
		context: audio_context,
		data_element: null
	};
}

window.audio_init_canvas = function audio_init_canvas(audio, canvas) {
	audio.canvas = canvas;
}

window.audio_set_source = function audio_set_source(audio) {
	audio.source = audio.context.createBufferSource();
	audio.source.buffer = audio.buffer;
	audio.source.connect(audio.context.destination);
	audio.is_playing = false;
	audio.source.onended = () => {
		audio.source.disconnect();
		audio_set_source(audio);
	};
}

window.audio_update_data = function audio_update_data(audio) {
	if (!audio.buffer) {
		audio.data_element.remove_children();
		return;
	}

	let seconds = audio.buffer.length / audio.buffer.sampleRate;
	let seconds_post = "seconds";

	if (Math.abs(seconds) === 1)
		seconds_post = "second";

	let channels_post = "channels";
	if (audio.buffer.numberOfChannels === 1)
		channels_post = "channel";

	audio.data_element.remove_children().append(
		text([
			`${seconds.toFixed(2)} ${seconds_post}`,
			`${audio.buffer.sampleRate} Hz`,
			`${audio.buffer.length} samples`,
			`${audio.buffer.numberOfChannels} ${channels_post}`
		].join(" | "))
	);
}

window.audio_play = function audio_play(audio) {
	if (audio.is_playing) {
		audio_set_source(audio);
	}
	audio.is_playing = true;

	setTimeout(() => {
		if (audio.source) {
			audio.source.start();
		}
	}, 1);
}

window.audio_channel_data = function (audio) {
	let cd = [];
	for (let i = 0; i < audio.buffer.numberOfChannels; i++) {
		cd.push(audio.buffer.getChannelData(i));
	}
	return cd;
}

window.audio_encode_wav = function (audio, depth = 32) {
	const channel_data = audio_channel_data(audio);
	return wav.encode(channel_data, {
		sampleRate: audio.buffer.sampleRate,
		float: true,
		bitDepth: depth
	});
}

window.audio_open_file = async function audio_open_file(input_el, audio_context) {
	let file = fs.readFileSync(input_el.value);
	return audio_context.decodeAudioData(file.buffer);
}

window.audio_buffer_copy = function audio_buffer_copy(audio_buffer) {
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

window.audio_buffer_copy_with_channels = function audio_buffer_copy_with_channels(audio_buffer, channels) {
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

window.input = audio_init();
window.output = audio_init();

// window.encode_ogg = function (audio, quality, bitrate) {
// 	let decoder = new ogg.Decoder();

// 	decoder.
// }