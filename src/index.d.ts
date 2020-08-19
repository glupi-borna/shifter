type PartialRecord<K extends (string | symbol | number), V> = Partial<Record<K, V>>;

declare module 'fft.js' {
	export = FFT;

	class FFT {
		size: number;
		_csize: number;
		table: number[];
		_width: number;
		_bitrev: number[];
		_inv: number;

		_out: number[];
		_data: number[];

		/**
		 * NOTE: size MUST be a power of two and MUST be bigger than 1.
		 */
		constructor(size: number);

		fromComplexArray(complex: number[], storage: number[]): number[];
		createComplexArray(): number[];
		toComplexArray(input: number[], storage: number[]): number[];
		completeSpectrum(spectrum: number[]): number[];
		transform(out: number[], data: number[]): void;
		realTransform(out: number[], data: number[]): void;
		inverseTransform(out: number[], data: number[]): void;
	}
}

declare module 'audio-loader' {
	export = audio_loader;
	function audio_loader(path: string, cb: {context: AudioContext}): Promise<AudioBuffer>;
}

declare var pwd: string;

declare var el: typeof document.createElement;
declare var text: typeof document.createTextNode;
declare var find: typeof document.querySelector;
declare var find_all: typeof document.querySelectorAll;
declare var mouse_up: Signal<void>;
declare var mouse_move_x: Signal<number>;
declare var mouse_move_y: Signal<number>;
declare var shift_down: boolean;
declare var ctrl_down: boolean;
declare var alt_down: boolean;
declare var input: Audio;
declare var output: Audio;

declare var latest_filter_job: number;
declare var job_kill_signal: Signal<number>;
declare var JOB_KILLED: Symbol;

declare var open_audio_file: (input_el: HTMLInputElement, context: AudioContext) => Promise<AudioBuffer>;

declare var button: (label: string, onclick?: () => void) => HTMLButtonElement;
declare var row: (...elements: HTMLElement[]) => HTMLDivElement;
declare var column: (...elements: HTMLElement[]) => HTMLDivElement;
declare var knob: (val: number, size?: number, min?: number, max?: number, unit?: string) => Knob;
declare var shallow_copy: <T>(obj: T) => T;
declare var filter_bind: <T extends HTMLElement, S extends Record<string, any>>(filter: Filter<S>, filter_settings_key: keyof S, element: T, element_key?: keyof T) => T;
declare var render_audio: (audio: Audio) => void;
declare var apply_pipeline: () => void;
declare var unwrap: (obj: any) => any;
declare var globalize: (obj: any) => void;
declare var watch_stylesheet: (full_path: string, id: string) => void;
declare var array_get: <T>(arr: ArrayLike<T>, index: number) => T;
declare var fft_resolution: (sample_rate: number, fft_len: number) => number;
declare var fft_freq: (fft_index: number, fft_resolution: number) => number;
declare var update_filter_cache: (filter: Filter<any>, buffer: AudioBuffer) => AudioBuffer;
declare var filter_cache_string: (filter: Filter<any>) => string;
declare var
invalidate_filter_cache: (filter: Filter<any>) => void;
declare var create_filter: <T>(filter: Filter<T>) => Filter<T>;
declare var _cur_id: number;
declare var inc_id: () => number;
declare var swap_elements: (el1: HTMLElement, el2: HTMLElement) => void;

declare var promptTextbox: HTMLInputElement;
declare var promptWrapper: HTMLDivElement;
declare var promptPrefix: HTMLDivElement;
declare var promptSuffix: HTMLDivElement;

declare var prompt_string: (question: string, current_value: string, prefix?: string, suffix?: string) => Promise<string>;
declare var prompt_number: (question: string, current_value: number, prefix?: string, suffix?: string) => Promise<number>;

declare var STOP_LISTENING: Symbol;

interface Window {
	Signal: new (init: any) => Signal<any>;
}

declare class Signal<T> {
	static END: Symbol;
	static KILL: Symbol;
	static UNSUB: Symbol;

	constructor(initial_value?: T);
	subscribe(fn: (val: T) => void | Symbol, immediate?: boolean): { unsubscribe: () => void };
	emit(val: T): void;
	end():void;
}

declare namespace NodeJS {
	interface Process {
		mainModule: {
			filename: string
		}
	}
}

interface HTMLElement {
	set_style: (style_dict: {[key: string]: any}) => this;
	allow_dragging: (drag_group: string, get_drag_data: (el: this) => Record<string, any>) => this;
	allow_dropping: (drag_group: string, handler: (drop_event: DragEvent) => void) => this;
	prevent_context_menu: () => this;
}

interface Element {
	set_props: (props: Partial<this>) => this;
	set_attrs: (attrs: {[key: string]: any}) => this;
	set_class: (...class_names: string[]) => this;
	remove_class: (...class_names: string[]) => this;
	toggle_class: (...class_names: string[]) => this;
	then: (cb: (el: this) => void) => this;
	append_after: (...children: Element[]) => this;
	append_before: (...children: Element[]) => this;
	append_first: (...children: Element[]) => this;
	append: (...children: (Element | Node)[]) => this;
	interval: (cb: (el: this) => void, interval: number) => this;
	store: {[key: string]: any};
}

interface EventTarget {
	on: (event: string, cb: (ev: any) => any) => this;
}

interface Audio {
	canvas: HTMLCanvasElement;
	buffer: AudioBuffer;
	source: AudioBufferSourceNode;
	button: HTMLButtonElement;
	is_playing: boolean;
	context: AudioContext;
}

interface FilterBase<T extends Record<string, any>> {
	type: string;
	mix_factor?: number;
	enabled?: boolean;
	fn: Function;
	before_processing?: (settings?: T) => void;
	// @TODO: after_processing, on_load, on_unload
	settings?: T;
	display: (filter?: Filter<T>) => HTMLElement;
	cache_string?: string;
	cache_buffer?: AudioBuffer;
	container?: HTMLDivElement;
}

interface SampleData {
	volume: number;
	volume_next: number;
	volume_previous: number;
	progress: number;
	index: number;
	count: number;
	channel_index: number;
	channel_count: number;
}

interface SampleFilter<T> extends FilterBase<T> {
	type: 'sample';
	fn: (sample: SampleData, settings: T) => (number | number[] | null | undefined);
}

interface FFTFilter<T> extends FilterBase<T> {
	type: 'fft';
	fft_power: number,
	fn: (fft: Float32Array, fft_resolution: number, settings: T) => Float32Array;
}

interface GeneratorFilter<T> extends FilterBase<T> {
	type: 'generator';
	fn: (sample_period: number, volume: number, settings: T) => number[][];
}

interface BufferFilter<T> extends FilterBase<T> {
	type: 'buffer';
	fn: (buffer: AudioBuffer, filter: BufferFilter<T>) => AudioBuffer;
}

interface Math {
	clamp: (val: number, min: number, max: number) => number;
	remap: (val: number, r1min: number, r1max: number, r2min: number, r2max: number) => number;
	lerp: (start: number, end: number, amount: number) => number;
}

declare class Knob extends HTMLElement {
	logscale: boolean;
	integer: boolean;
	step_count: number;
	value: number;
	unit: string;
	min: number;
	max: number;
	size: number;
	label: string;

	value_format: (val: number) => string;

	connectedCallback(): void;

	disconnectedCallback(): void;

	update_step(): void;

	update_rotation(): void;
}

type Filter<T> = SampleFilter<T> | BufferFilter<T> | FFTFilter<T> | GeneratorFilter<T>;