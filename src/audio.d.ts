declare var set_source: (audio: Audio) => void;
declare var play_audio: (audio: Audio) => void;
declare var channel_data: (audio: Audio) => void;
declare var encode_wav: (audio: Audio) => Buffer;
declare var encode_mp3: (audio: Audio) => Buffer;

interface Audio {
	canvas: HTMLCanvasElement;
	amp_canvas: OffscreenCanvas;
	fft_canvas: OffscreenCanvas;
	line_canvas: OffscreenCanvas;
	buffer: AudioBuffer;
	source: AudioBufferSourceNode;
	button: HTMLButtonElement;
	is_playing: boolean;
	context: AudioContext;
	data_element: HTMLDivElement;
}