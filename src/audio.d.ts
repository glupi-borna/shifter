declare var input: Audio;
declare var output: Audio;
declare var audio_open_file: (input_el: HTMLInputElement, context: AudioContext) => Promise<AudioBuffer>;
declare var audio_init: () => Audio;
declare var audio_init_canvas: (audio: Audio, canvas: HTMLCanvasElement) => void;
declare var audio_set_source: (audio: Audio) => void;
declare var audio_play: (audio: Audio) => void;
declare var audio_channel_data: (audio: Audio) => void;
declare var audio_update_data: (audio: Audio) => void;

declare var audio_buffer_copy: (audio_buffer: AudioBuffer) => AudioBuffer;
declare var audio_buffer_copy_with_channels: (audio_buffer: AudioBuffer, channels: Float32Array[]) => AudioBuffer;

declare var audio_encode_wav: (audio: Audio) => Buffer;
declare var audio_encode_mp3: (audio: Audio) => Buffer;

interface Audio {
	render_amp: boolean;
	render_fft: boolean;
	canvas: HTMLCanvasElement;
	offscreen_canvas_map: Map<string, OffscreenCanvas>;

	buffer: AudioBuffer;
	source: AudioBufferSourceNode;

	button: HTMLButtonElement;
	is_playing: boolean;
	context: AudioContext;
	data_element: HTMLDivElement;
}