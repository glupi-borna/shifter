window.el = function (tag, options) {
	let it = document.createElement(tag, options);
	it.store = {};
	return it;
}
window.text = document.createTextNode.bind(document);
window.find = document.querySelector.bind(document);
window.find_all = document.querySelectorAll.bind(document);

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

extend(HTMLSelectElement, {
	set_options: function(opts, def) {
		if (def === null || def === undefined) {
			opts = {"...": null, ...opts};
		}

		let options = select_options(opts);

		/** @type {HTMLSelectElement} */
		let sel = (this);
		sel.options_map = opts;

		if (!sel.initialized) {
			Object.defineProperty(sel, "current_option_value", {
				get() { return this.__current_option_value; },
				set(v) {
					let ind = Object.values(this.options_map).indexOf(v);
					if (ind !== -1) {
						this.__current_option_value = v;
					}
				},
			});

			sel.on("input", () => {
				sel.__current_option_value = sel.options_map[sel.value];
			}).on("contextmenu", (ev) => {
				prompt_options(sel.labels[0]?.innerText || "", sel.options_map).then(res => {
					if (res[0]) {
						sel.value = res[1];
						sel.dispatchEvent(new Event("prompt_changed"));
						sel.dispatchEvent(new Event("input"));
						sel.dispatchEvent(new Event("change"));
					}
				});
				ev.preventDefault();
			});

			sel.initialized = true;
		}

		sel.remove_children();

		return sel.append(...options).set_props(
			{value: def || "..."}
		)
	}
});

extend(HTMLElement, {
	set_style: function set_style(style_dict) {
		/** @type {HTMLElement} */
		let self = (this);

		for (let key in style_dict) {
			self.style.setProperty(key, style_dict[key]);
		}

		return self;
	},

	allow_dragging: function allow_dragging(drag_group, get_drag_data) {
		/** @type {HTMLElement} */
		let self = (this);

		self.store.allow_dragging = true;
		return self.set_props(
			{draggable: true}
		).on('dragstart', /**@arg {DragEvent} ev*/(ev) => {
			let data = get_drag_data(self);
			ev.dataTransfer.setData("text/draggroup", drag_group);

			for (let key in data) {
				ev.dataTransfer.setData(key, data[key]);
			}

			document.body.set_attrs({
				"draggroup": drag_group
			});
		}).on('dragend', () => {
			document.body.removeAttribute('draggroup');
		}).on('child_added', () => {
			setTimeout(() => {
				let children = Array.from(self.children);

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
	},

	allow_dropping: function allow_dropping(drag_group, drop_handler) {
		/** @type {HTMLElement} */
		let self = (this);

		return self.on('dragover', (ev) => {
			ev.preventDefault();
		}).on('drop', /**@arg {DragEvent} ev*/(ev) => {
			if (ev.dataTransfer.getData("text/draggroup") === drag_group || drag_group === "any") {
				drop_handler(ev);
			}
		});
	},

	prevent_context_menu: function prevent_context_menu() {
		/** @type {HTMLElement} */
		let self = (this);

		self.on("contextmenu", (ev) => {
			ev.preventDefault();
		});
		return self;
	}
});

extend(EventTarget, {
	on: function on(ev, cb) {
		/** @type {EventTarget} */
		let self = (this);

		let fun = (evt) => {
			let res = cb(evt);
			if (res === STOP_LISTENING) {
				self.removeEventListener(ev, fun);
			}
		};
		self.addEventListener(ev, fun);
		return self;
	}
});

extend(Element, {
	disappear: function disappear() {
		let style_string = "opacity 0.25s"
		if (this.style.transition) {
			style_string = ", " + style_string;
		};

		this.set_style({
			transition: style_string
		});

		this.set_style({
			opacity: "0"
		});

		return new Promise(resolve => {
			setTimeout(() => {
				this.remove();
				resolve();
			}, 250);
		});
	},

	set_props: function set_props(props) {
		/** @type {Element} */
		let self = (this);

		Object.assign(self, props);
		return self;
	},

	set_attrs: function set_attrs(props) {
		/** @type {Element} */
		let self = (this);

		for (let key in props) {
			if (props[key] !== null) {
				self.setAttribute(key, props[key]);
			} else {
				self.removeAttribute(key);
			}
		}

		return self;
	},

	remove_children: function remove_children() {
		/** @type {Element} */
		let self = (this);

		while (self.firstChild) {
			self.firstChild.remove();
		}

		return self;
	},

	set_class: function set_class(...class_names) {
		/** @type {Element} */
		let self = (this);

		self.classList.add(...class_names);
		return self;
	},

	remove_class: function remove_class(...class_names) {
		/** @type {Element} */
		let self = (this);

		self.classList.remove(...class_names);
		return self;
	},

	toggle_class: function toggle_class(...class_names) {
		/** @type {Element} */
		let self = (this);

		for (let name of class_names) {
			self.classList.toggle(name);
		}
		return self;
	},

	then: function then(cb) {
		/** @type {Element} */
		let self = (this);

		cb(self);
		return self;
	},

	append_after: function append_after(...elements) {
		/** @type {Element} */
		let self = (this);

		elements = elements.reverse();
		for (let el of elements) {
			if (!el) continue;
			self.insertAdjacentElement('afterend', el);
		}
		return self;
	},

	append_before: function append_before(...elements) {
		/** @type {Element} */
		let self = (this);

		for (let el of elements) {
			if (!el) continue;
			self.insertAdjacentElement('beforebegin', el);
		}
		return self;
	},

	append_first: function append_first(...elements) {
		/** @type {Element} */
		let self = (this);

		elements = elements.reverse();
		for (let el of elements) {
			if (!el) continue;
			self.insertAdjacentElement('afterbegin', el);
		}

		self.dispatchEvent(new Event('child_added'));

		return self;
	},

	append: function append(...elements) {
		/** @type {Element} */
		let self = (this);

		for (let el of elements) {
			if (!el) continue;
			if (el instanceof Element) {
				self.insertAdjacentElement('beforeend', el);
			} else {
				self.appendChild(el);
			}
		}

		self.dispatchEvent(new Event('child_added'));

		return self;
	},

	interval: function interval(cb, int) {
		/** @type {Element} */
		let self = (this);

		let interval = setInterval(() => {
			cb(self);

			if (!self.isConnected) {
				clearInterval(interval);
			}
		}, int);
		return self;
	}
});

window.space = function space(min_width = 0, flex_max = 1) {
	return el('div').set_class('flex-space').set_style({
		"--min-width": `${min_width}px`,
		"--flex-max": flex_max
	});
}

window.button = function button(label, onclick = null) {
	return el("button").append(
		text(label)
		).on('click', onclick);
}

promptTextbox.on("keypress", ev => {
	ev.stopPropagation();
});

window.prompt_number = function (q, val, pre='', suf = '') {
	promptTextbox.dispatchEvent(new Event('new_prompt'));

	promptPrefix.innerText = pre;
	promptSuffix.innerText = suf;

	promptTextbox.set_attrs({list: null});

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

window.prompt_string = function (q, val, pre='', suf = '') {
	promptTextbox.dispatchEvent(new Event('new_prompt'));
	promptPrefix.innerText = pre;
	promptSuffix.innerText = suf;

	promptTextbox.set_attrs({list: null});

	promptWrapper.set_class('enabled');
	promptTextbox.placeholder = q;
	promptTextbox.type = "text";
	promptTextbox.value = val;

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
				resolve(promptTextbox.value);
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

window.prompt_options = function (q, opts, pre='', suf = '') {
	promptTextbox.dispatchEvent(new Event('new_prompt'));

	promptPrefix.innerText = pre;
	promptSuffix.innerText = suf;

	promptTextbox.set_attrs({list: promptOptions.id});
	promptOptions.remove_children().append(...select_options(opts));

	promptWrapper.set_class('enabled');
	promptTextbox.placeholder = q;
	promptTextbox.type = "text";
	promptTextbox.value = "";

	promptTextbox.focus();

	return new Promise((resolve, reject) => {
		promptTextbox.on("new_prompt", () => {
			reject("Cancelled");
			return STOP_LISTENING;
		});

		promptTextbox.on("keydown", (ev) => {
			ev.stopPropagation();

			if (ev.key === "Enter") {
				let val = opts[promptTextbox.value];
				promptWrapper.remove_class('enabled');
				resolve([val, promptTextbox.value]);
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

window.select_popover = async function (hook_element, options) {
	return new Promise((resolve, reject) => {
		let it = anchored_popover(hook_element, true, false)
		.append(
			row(...Object.keys(options).map(key => {
				return button(key, () => {
					resolve(options[key]);
					it.set_style({
						"pointer-events": "none"
					});

					it.disappear();
				});
			})).set_class("rect")
		);

		mouse_up.subscribe(() => {
			setTimeout(() => {
				it.disappear();
				reject("Cancelled.");
			}, 1);

			return Signal.UNSUB;
		});
	});
};

window.anchored_popover = function (hook_element, mirror_parent_width = false, animate = true) {
	let it = el("div").set_class("anchored-popover");

	document.body.append(it);

	it.set_style({
		"opacity": 1
	});

	if (animate) {
		it.set_style({
			transition: "opacity 0.1s, left 0.25s, top 0.25s, transform 0.25s"
		});
	}

	it.interval(() => {
		let rect = hook_element.getBoundingClientRect();

		let trans_x = -100;
		let left = rect.left;

		if (rect.left < window.innerWidth * 0.5) {
			trans_x = 0;
			left = rect.right;
		}

		let trans_y = -100;
		let top = rect.top;

		if (rect.top < window.innerHeight * 0.5) {
			trans_y = 0;
			top = rect.bottom;
		}

		if (mirror_parent_width) {
			it.set_style({
				"min-width": rect.width + "px",
			});

			left = rect.left;
			trans_x = 0;
		}

		it.set_style({
			"left": left,
			"top": top,
			"transform": `translate(${trans_x}%, ${trans_y}%)`
		});
	}, 100);

	return it;
}

// @ts-ignore
class Knob extends HTMLElement {
	#value = 0;
	#unit  = "";
	#min   = 0;
	#max   = 100;
	#size = 32;
	#label = "";
	/** @type {HTMLDivElement | null} */
	#labelElement = null;
	/** @type {HTMLDivElement | null} */
	#indicator = null;
	logscale = false;
	integer  = false;
	step_count = 100;
	value_format = prettify_number;

	get value() {
		let val = Math.clamp(this.#value, 0, 1);
		if (this.logscale) {
			val = Math.remap(val, 0, 1, 0, 10);
			val = 2 ** val;
			val = Math.remap(val, 1, 1024, this.#min, this.#max);
		} else {
			val = Math.lerp(this.#min, this.#max, val);
		}

		if (this.integer) {
			return Math.round(val);
		} else {
			return val;
		}
	}
	set value(val) {
		val = Math.clamp(val, this.#min, this.#max);

		if (this.logscale) {
			val = Math.remap(val, this.#min, this.#max, 1, 1024);
			val = Math.remap(Math.log2(val), 0, 10, 0, 1);
		} else {
			val = Math.remap(val, this.min, this.max, 0, 1);
		}

		this.#value = val;

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
		this.update_rotation();
	}

	get max() {
		return this.#max;
	}
	set max(val) {
		this.#max = val;
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
			let modifier = shift_down ? 0.001 : 0.01;
			this.#value = Math.clamp(this.#value - Math.sign(ev.deltaY) * modifier, 0, 1);
			this.update_rotation();
		};

		this.__mousedown_listener = /** @arg {MouseEvent} ev */(ev) => {
			if (ev.buttons & 2) {
				prompt_number(this.label, this.value, '', this.unit)
				.then(res => {
					this.value = res;
				}).catch().finally(() => {
					this.focus();
				});
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
				let modifier = shift_down ? 0.001 : 0.01;
				this.#value = Math.clamp(this.#value - (amt * 0.1) * modifier, 0, 1);
				this.update_rotation();

				if (!down) {
					return Signal.UNSUB;
				}

				return undefined;
			});
		};

		let indicator_container = null;

		this.on("mouseenter", () => {
			if (indicator_container) {
				this.#indicator = null;
				indicator_container.disappear();
			}

			indicator_container = anchored_popover(this);
			indicator_container.set_style({
				"pointer-events": "none"
			});
			this.#indicator = el("div").set_class("rect");
			indicator_container.append(this.#indicator);
			this.update_indicator();
		});

		this.on("mouseleave", () => {
			if (indicator_container) {
				this.#indicator = null;
				indicator_container.disappear();
			}
		});
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

	update_rotation() {
		this.dispatchEvent(new Event("input"));
		let rotation = this.#value;

		this.set_style({
			"--rotation": (rotation * 270 - 45) + "deg",
			"--perc": 100 * rotation * 270 / 360 + "%"
		});

		this.update_indicator();
	}

	update_indicator() {
		if (this.#indicator) {
			this.#indicator.remove_children().append(text(this.value_format(this.value) + " " + this.unit));
		}
	}
}
customElements.define('shifter-knob', Knob);

window.knob = function knob(val, size = 32, min = 0, max = 100, unit = "", logscale = false) {
	let k = /** @type {Knob} */ (el('shifter-knob'));
	k.logscale = logscale;

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

window.select_options = function select_options(opts) {
	let out = [];
	for (let label in opts) {
		out.push(el("option").set_props({value: label, innerText: label}))
	}

	return out;
}

window.select = function select(opts, def) {
	return el("select").set_options(opts, def);
}

function default_bind_element_key(element) {
	if (element instanceof HTMLSelectElement) {
		return 'current_option_value';
	} else if (element instanceof HTMLInputElement && element.type == "checkbox") {
		return "checked";
	}

	return "value";
}

window.filter_bind = function(filter, key, element, /** @type {any} */element_key=default_bind_element_key(element)) {
	let updatesettings = () => {
		if (filter.settings[key] != element[element_key]) {
			filter.settings[key] = element[element_key];
			filter_invalidate_cache(filter);
			filter_apply_pipeline();
		}
	};

	let int;
	int = setInterval(function (filter, key, el, el_key, int, updatesettings) {
		if (el[el_key] !== filter.settings[key])
			el[el_key] = filter.settings[key];

		if (!el.isConnected) {
			clearInterval(int);
			el.removeEventListener('input', updatesettings);
		}
	}, 250, filter, key, element, element_key, int, updatesettings);

	element.on('input', updatesettings);
	return element;
};