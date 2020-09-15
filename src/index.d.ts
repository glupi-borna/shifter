type PartialRecord<K extends (string | symbol | number), V> = Partial<Record<K, V>>;

declare module 'audio-loader' {
	export = audio_loader;
	function audio_loader(path: string, cb: {context: AudioContext}): Promise<AudioBuffer>;
}

declare var pwd: string;
declare var FFT: typeof import ("./fft.js").default;

declare var mouse_up: Signal<void>;
declare var mouse_move_x: Signal<number>;
declare var mouse_move_y: Signal<number>;
declare var shift_down: boolean;
declare var ctrl_down: boolean;
declare var alt_down: boolean;

declare var shallow_copy: <T>(obj: T) => T;

declare var unwrap: (obj: any) => any;
declare var globalize: (obj: any) => void;
declare var extend: (obj: any, extensions: Record<string, any>) => void;
declare var watch_stylesheet: (full_path: string, id: string) => void;
declare var array_get: <T>(arr: ArrayLike<T>, index: number) => T;
declare var _cur_id: number;
declare var inc_id: () => number;
declare var prettify_number: (num: number, places?: number) => string;


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

interface Math {
	clamp: (val: number, min: number, max: number) => number;
	remap: (val: number, r1min: number, r1max: number, r2min: number, r2max: number) => number;
	lerp: (start: number, end: number, amount: number) => number;
}