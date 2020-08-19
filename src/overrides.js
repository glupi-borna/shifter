// Initializes overrides for helper methods.

const exec = require('child_process').exec;
const load_audio_file = require('audio-loader');
const fs = require('fs');
const path = require('path');
window.pwd = path.dirname(process.mainModule.filename);

window.el = function (tag, options) {
	let it = document.createElement(tag, options);
	it.store = {};
	return it;
}
window.text = document.createTextNode.bind(document);
window.find = document.querySelector.bind(document);
window.find_all = document.querySelectorAll.bind(document);

window.STOP_LISTENING = Symbol("Stop listening");

window.open_audio_file = function (input_el, audio_context) {
	return load_audio_file(
		input_el.value,
		{context: audio_context}
	);
}

window.watch_stylesheet = function (full_path, id) {
	let out = full_path.slice(0, -4) + "css";
	let sheet = el("style").set_props({'id': id});

	document.head.append(sheet);

	if (fs.existsSync(full_path)) {
		console.log("Recompiling...");
		exec('sass ' + full_path + ' ' + out, (err) => {
			console.log("Recompiled!");

			if (err) {
				console.log(err);
			}

			sheet.innerHTML = fs.readFileSync(out, 'utf-8');
		});

		fs.watchFile(full_path, () => {
			if (fs.existsSync(full_path)) {
				console.log("Recompiling...");
				exec('sass ' + full_path + ' ' + out, (err) => {
					console.log("Recompiled!");

					if (err) {
						console.log(err);
					}

					sheet.innerHTML = fs.readFileSync(out, 'utf-8');
				});
			} else {
				fs.unwatchFile(full_path);
			}
		});
	} else {
		throw new Error(pwd);
	}
}

window.shallow_copy = function (obj) {
	return Object.assign({}, obj);
}

window.unwrap = function (obj) {
	let new_obj = {};
	for (let prop of Object.getOwnPropertyNames(obj)) {
		new_obj[prop] = obj[prop];
	}
	return new_obj;
}

window.globalize = function (obj) {
	Object.assign(window, unwrap(obj));
}

window.swap_elements = function swap_elements(el1, el2) {
	var parent2 = el2.parentNode;
	var next2 = el2.nextSibling;

	if (next2 === el1) {
		parent2.insertBefore(el1, el2);
	} else {
		el1.parentNode.insertBefore(el2, el1);

		if (next2) {
			parent2.insertBefore(el1, next2);
		} else {
			parent2.appendChild(el1);
		}
	}
}

Math.clamp = function clamp(val, min, max) {
	if (val < min) {
		return min;
	} else if (val > max) {
		return max;
	}

	return val;
}

Math.remap = function remap(val, from_low, from_high, to_low, to_high) {
	return to_low + (val - from_low) * (to_high - to_low) / (from_high - from_low);
}

Math.lerp = function lerp(start, end, amt) {
	return (1 - amt) * start + amt * end;
}

HTMLElement.prototype.set_style = function set_style(style_dict) {
	for (let key in style_dict) {
		this.style.setProperty(key, style_dict[key]);
	}

	return this;
}

HTMLElement.prototype.allow_dragging = function allow_dragging(drag_group, get_drag_data) {
	this.store.allow_dragging = true;
	return this
	.set_props({draggable: true})
	.on('dragstart', /**@arg {DragEvent} ev*/(ev) => {
		let data = get_drag_data(this);
		ev.dataTransfer.setData("text/draggroup", drag_group);

		for (let key in data) {
			ev.dataTransfer.setData(key, data[key]);
		}

		document.body.set_attrs({
			"draggroup": drag_group
		});
	})
	.on('dragend', () => {
		document.body.removeAttribute('draggroup');
	})
	.on('child_added', () => {
		setTimeout(() => {
			let children = Array.from(this.children);

			for (let child of children) {
				if (child instanceof HTMLElement && !child.store.allow_dragging) {
					child.draggable = true;
					child.on('dragstart', () => {
						event.preventDefault();
						event.stopPropagation();
					});
				}
			}
		});
	});
};

HTMLElement.prototype.allow_dropping = function allow_dropping(drag_group, drop_handler) {
	return this
	.on('dragover', (ev) => {
		ev.preventDefault();
	})
	.on('drop', /**@arg {DragEvent} ev*/(ev) => {
		if (ev.dataTransfer.getData("text/draggroup") === drag_group || drag_group === "any") {
			drop_handler(ev);
		}
	});
}

HTMLElement.prototype.prevent_context_menu = function prevent_context_menu() {
	this.on("contextmenu", (ev) => {
		ev.preventDefault();
	});
	return this;
}

EventTarget.prototype.on = function on(ev, cb) {
	let fun = (evt) => {
		let res = cb(evt);
		if (res === STOP_LISTENING) {
			this.removeEventListener(ev, fun);
		}
	};
	this.addEventListener(ev, fun);
	return this;
}

Element.prototype.set_props = function set_props(props) {
	Object.assign(this, props);
	return this;
}

Element.prototype.set_attrs = function set_attrs(props) {
	for (let key in props) {
		this.setAttribute(key, props[key]);
	}

	return this;
}

Element.prototype.set_class = function set_class(...class_names) {
	this.classList.add(...class_names);
	return this;
}

Element.prototype.remove_class = function remove_class(...class_names) {
	this.classList.remove(...class_names);
	return this;
}

Element.prototype.toggle_class = function toggle_class(...class_names) {
	for (let name of class_names) {
		this.classList.toggle(name);
	}
	return this;
}

Element.prototype.then = function then(cb) {
	cb(this);
	return this;
}

Element.prototype.append_after = function append_after(...elements) {
	elements = elements.reverse();
	for (let el of elements) {
		if (!el) continue;
		this.insertAdjacentElement('afterend', el);
	}
	return this;
}

Element.prototype.append_before = function append_before(...elements) {
	for (let el of elements) {
		if (!el) continue;
		this.insertAdjacentElement('beforebegin', el);
	}
	return this;
}

Element.prototype.append_first = function append_first(...elements) {
	elements = elements.reverse();
	for (let el of elements) {
		if (!el) continue;
		this.insertAdjacentElement('afterbegin', el);
	}

	this.dispatchEvent(new Event('child_added'));

	return this;
}

Element.prototype.append = function append(...elements) {
	for (let el of elements) {
		if (!el) continue;
		if (el instanceof Element) {
			this.insertAdjacentElement('beforeend', el);
		} else {
			this.appendChild(el);
		}
	}

	this.dispatchEvent(new Event('child_added'));

	return this;
}

Element.prototype.interval = function interval(cb, int) {
	let interval = setInterval(() => {
		cb(this);

		if (!this.isConnected) {
			clearInterval(interval);
		}
	}, int);
	return this;
}

window.button = function button(label, onclick = null) {
	return el("button").append(
		text(label)
		).on('click', onclick);
}

window.prompt_number = function (q, val, pre='', suf = '') {
	promptTextbox.dispatchEvent(new Event('new_prompt'));

	promptPrefix.innerText = pre;
	promptSuffix.innerText = suf;

	promptWrapper.set_class('enabled');
	promptTextbox.placeholder = q;
	promptTextbox.type = "number";
	promptTextbox.valueAsNumber = val;

	promptTextbox.focus();

	return new Promise((resolve, reject) => {
		promptTextbox.on("new_prompt", () => {
			reject("Cancelled");
			return STOP_LISTENING;
		});

		promptTextbox.on("keydown", (ev) => {
			ev.stopPropagation();

			if (ev.key === "Enter") {
				promptWrapper.remove_class('enabled');
				resolve(promptTextbox.valueAsNumber);
				return STOP_LISTENING;
			}

			if (ev.key === "Escape") {
				promptWrapper.remove_class('enabled');
				reject("Cancelled");
				return STOP_LISTENING;
			}

			return undefined;
		})
	});
}

class Knob extends HTMLElement {
	#value = 0;
	#realvalue = 0;
	#unit  = "";
	#min   = 0;
	#max   = 100;
	#step = 1;
	#size = 32;
	#label = "";
	/** @type {HTMLDivElement | null} */
	#labelElement = null;
	logscale = false;
	integer  = false;
	step_count = 100;
	value_format = function (/** @type {number} */ val) {
		return val.toFixed(2);
	};

	get value() {
		return this.#value;
	}
	set value(val) {
		this.#realvalue = Math.clamp(val, this.#min, this.#max);

		if (this.integer) {
			this.#value = Math.clamp(Math.round(this.#realvalue), this.#min, this.#max);
		} else {
			this.#value = this.#realvalue;
		}

		this.update_rotation();
	}

	get unit() {
		return this.#unit;
	}
	set unit(val) {
		this.#unit = val;
		this.update_rotation();
	}

	get min() {
		return this.#min;
	}
	set min(val) {
		this.#min = val;
		this.update_step();
		this.update_rotation();
	}

	get max() {
		return this.#max;
	}
	set max(val) {
		this.#max = val;
		this.update_step();
		this.update_rotation();
	}

	get size() {
		return this.#size;
	}
	set size(val) {
		this.#size = val;
		this.set_style({
			"--size": val + "px"
		});
	}

	get label() {
		return this.#label;
	}
	set label(val) {
		if (this.#labelElement) {
			this.#labelElement.innerText = val;
		}

		this.#label = val;
	}

	constructor() {
		super();

		this.prevent_context_menu();

		this.__wheel_listener = (/** @type {WheelEvent} */ ev) => {
			let modifier = shift_down ? this.#step * 0.1 : this.#step;

			if (this.logscale) {
				modifier *= Math.log2(Math.remap(this.#realvalue, this.#min, this.#max, 1.01, 2));
			}

			this.value = this.#realvalue - Math.sign(ev.deltaY) * modifier;
		};

		this.__mousedown_listener = /** @arg {MouseEvent} ev */(ev) => {
			if (ev.buttons & 2) {
				prompt_number(this.label, this.#realvalue, '', this.unit)
				.then(res => {
					this.value = res;
				}).catch();
				ev.preventDefault();
				ev.stopPropagation();
				return;
			}

			let down = true;

			mouse_up.subscribe(() => {
				down = false;
				return Signal.UNSUB;
			});

			mouse_move_y.subscribe((/** @type {number} */ amt) => {
				let modifier = shift_down ? this.#step * 0.1 : this.#step;

				if (this.logscale) {
					modifier *= Math.log2(Math.remap(this.#realvalue, this.#min, this.#max, 1.01, 2));
				}

				if (down) {
					this.value = this.#realvalue - amt * modifier;
				} else {
					return Signal.UNSUB;
				}

				return undefined;
			});
		};
	}

	connectedCallback() {
		this.update_rotation();

		if (!this.hasAttribute('tabindex')) {
			this.setAttribute('tabindex', '0');
			this.tabIndex = 0;
		}

		this.on("wheel", this.__wheel_listener);
		this.on("mousedown", this.__mousedown_listener);

		this.append(el('div').set_class('shifter-body'));
		this.append(el('div').set_class('shifter-nub'));
		this.append(this.#labelElement = el('div').set_class('shifter-label'));
		this.#labelElement.innerText = this.#label;
	}

	disconnectedCallback() {
		this.removeEventListener("wheel", this.__wheel_listener);
		this.removeEventListener("mousedown", this.__mousedown_listener);

		while (this.firstChild) {
			this.firstChild.remove();
		}
	}

	update_step() {
		let range = this.max - this.min;
		this.#step  = range / Math.max(this.step_count, 1);
	}

	update_rotation() {
		let rotation = Math.remap(this.value, this.min, this.max, 0, 1);
		if (this.logscale) {
			rotation = Math.remap(rotation, 0, 1, 1, 2);
			rotation = Math.log2(rotation);
		}

		this.set_style({
			"--rotation": (rotation * 270 - 45) + "deg",
			"--value": `"${this.value_format(this.value)}"`,
			"--unit": `"${this.unit}"`,
			"--perc": 100 * rotation * 270 / 360 + "%"
		});
		this.dispatchEvent(new Event("input"));
	}
}
customElements.define('shifter-knob', Knob);

window.knob = function knob(val, size = 32, min = 0, max = 100, unit = "") {
	let k = (/** @type {Knob} */ (el('shifter-knob')));
	k.set_props({
		min: min,
		max: max,
		size: size,
		unit: unit,
		value: val
	});
	return k;
};

window.row = function row(...els) {
	return el('div').set_class('flex-row').append(...els);
}

window.column = function column(...els) {
	return el('div').set_class('flex-column').append(...els);
}

window.filter_bind = function(filter, key, element, /** @type {any} */element_key='value') {
	let updatesettings = () => {
		if (filter.settings[key] != element[element_key]) {
			filter.settings[key] = element[element_key];
			invalidate_filter_cache(filter);
			apply_pipeline();
		}
	};

	let int;
	int = setInterval(function (filter, key, el, el_key, int, updatesettings) {
		el[el_key] = filter.settings[key];

		if (!el.isConnected) {
			clearInterval(int);
			el.removeEventListener('input', updatesettings);
		}
	}, 250, filter, key, element, element_key, int, updatesettings);

	element.on('input', updatesettings);
	return element;
};

/** @template T */
class _Signal {
	static END = Symbol('End signal');
	static KILL = Symbol('Kill signal');
	static UNSUB = Symbol('Unsubscribe signal');

	/** @arg {T | null} initial_value */
	constructor(initial_value = null) {
		this.value = initial_value;
		this.subs = new Map();
	}
	/** @arg {(a: T) => Symbol | null} fn @arg {boolean} immediate */
	subscribe(fn, immediate) {
		this.subs.set(fn, fn);

		if (immediate) {
			let res = fn(this.value);
			if (res === Signal.KILL || res === Signal.END) {
				this.end();
			} else if (res === Signal.UNSUB) {
				this.subs.delete(fn);
			}
		}

		return {
			unsubscribe: () => {
				this.subs.delete(fn);
			}
		};
	}

	/** @arg {T} val */
	emit(val) {
		this.value = val;

		let fns = Array.from(this.subs.values());

		let ended = false;

		for (let fn of fns) {
			let res = fn(this.value);
			if (res === Signal.KILL) {
				this.end();
				return;
			} else if (res === Signal.UNSUB) {
				this.subs.delete(fn);
			} else if (res === Signal.END) {
				ended = true;
			}
		}

		if (ended) {
			this.end();
		}
	}

	end() {
		this.subs.clear();
	}
}
window.Signal = _Signal;

window.mouse_up = new Signal();
window.mouse_move_x = new Signal(0);
window.mouse_move_y = new Signal(0);
window.addEventListener('mouseup', () => {
	mouse_up.emit(null);
});
window.addEventListener('mousemove', (ev) => {
	mouse_move_x.emit(ev.movementX);
	mouse_move_y.emit(ev.movementY);
});
