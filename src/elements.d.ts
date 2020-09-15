declare var fileInput: HTMLInputElement;
declare var fileOutput: HTMLInputElement;
declare var fileSave: HTMLButtonElement;

declare var inputCanvas: HTMLCanvasElement;
declare var inputButton: HTMLButtonElement;
declare var inputAMPButton: HTMLButtonElement;
declare var inputFFTButton: HTMLButtonElement;
declare var inputData: HTMLDivElement;

declare var outputCanvas: HTMLCanvasElement;
declare var outputButton: HTMLButtonElement;
declare var outputAMPButton: HTMLButtonElement;
declare var outputFFTButton: HTMLButtonElement;
declare var outputData: HTMLDivElement;

declare var pipelineContainer: HTMLDivElement;
declare var filterSelectElement: HTMLSelectElement;
declare var pipelineAddButton: HTMLButtonElement;

declare var promptTextbox: HTMLInputElement;
declare var promptWrapper: HTMLDivElement;
declare var promptPrefix: HTMLDivElement;
declare var promptSuffix: HTMLDivElement;
declare var promptOptions: HTMLDataListElement;

declare var STOP_LISTENING: Symbol;

declare var el: typeof document.createElement;
declare var text: typeof document.createTextNode;
declare var find: typeof document.querySelector;
declare var find_all: typeof document.querySelectorAll;

declare var select_options: (options: Record<string, any>) => HTMLOptionElement[];
declare var select: <T extends Record<string, any>>(options: T, default_val?: keyof T) => HTMLSelectElement;
declare var button: (label: string, onclick?: () => void) => HTMLButtonElement;
declare var row: (...elements: HTMLElement[]) => HTMLDivElement;
declare var column: (...elements: HTMLElement[]) => HTMLDivElement;
declare var space: (min_width?: number, flex_max?: number) => HTMLDivElement;
declare var knob: (val: number, size?: number, min?: number, max?: number, unit?: string, logscale?: boolean) => Knob;

declare var filter_bind: <T extends HTMLElement, S extends Record<string, any>>(filter: Filter<S>, filter_settings_key: keyof S, element: T, element_key?: keyof T) => T;

declare var swap_elements: (el1: HTMLElement, el2: HTMLElement) => void;

declare var prompt_string: (question: string, current_value: string, prefix?: string, suffix?: string) => Promise<string>;
declare var prompt_number: (question: string, current_value: number, prefix?: string, suffix?: string) => Promise<number>;
declare var prompt_options: <T>(question: string, options: Record<string, T>, prefix?: string, suffix?: string) => Promise<[T, string]>;

declare var anchored_popover: (hook_element: HTMLElement, mirror_parent_width?: boolean, animate?: boolean) => HTMLDivElement;

declare var select_popover: <T>(hook_element: HTMLElement, options: Record<string, T>) => Promise<T>;

interface HTMLSelectElement {
	options_map: Record<string, any>;
	current_option_value: any;
	__current_option_value: any;
	initialized: boolean;
	set_options: (opts: Record<string, any>, def?: any) => this;
}

interface HTMLElement {
	set_style: (style_dict: {[key: string]: any}) => this;
	allow_dragging: (drag_group: string, get_drag_data: (el: this) => Record<string, any>) => this;
	allow_dropping: (drag_group: string, handler: (drop_event: DragEvent) => void) => this;
	prevent_context_menu: () => this;
}

interface Element {
	remove_children: () => this;
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
	disappear: () => Promise<void>;
	store: {[key: string]: any};
}

interface EventTarget {
	on: (event: string, cb: (ev: any) => any) => this;
}

// @ts-ignore
declare class Knob extends HTMLElement {
	logscale: boolean;
	integer: boolean;
	value: number;
	unit: string;
	min: number;
	max: number;
	size: number;
	label: string;

	value_format: (val: number) => string;
	connectedCallback(): void;
	disconnectedCallback(): void;
	update_rotation(): void;
}