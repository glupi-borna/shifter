const wav = require("node-wav");

window.set_source = function set_source(audio) {
	audio.source = audio.context.createBufferSource();
	audio.source.buffer = audio.buffer;
	audio.source.connect(audio.context.destination);
	audio.is_playing = false;
	audio.source.onended = () => {
		audio.source.disconnect();
		set_source(audio);
	};
}

window.play_audio = function play_audio(audio) {
	if (audio.is_playing) {
		set_source(audio);
	}
	audio.is_playing = true;

	setTimeout(() => {
		if (audio.source) {
			audio.source.start();
		}
	}, 1);
}

window.channel_data = function (audio) {
	let cd = [];
	for (let i = 0; i < audio.buffer.numberOfChannels; i++) {
		cd.push(audio.buffer.getChannelData(i));
	}
	return cd;
}

window.encode_wav = function (audio, depth = 32) {
	return wav.encode(channel_data(audio), {sampleRate: audio.buffer.sampleRate, float: true, bitDepth: depth});
}

// window.encode_ogg = function (audio, quality, bitrate) {
// 	let decoder = new ogg.Decoder();

// 	decoder.
// }