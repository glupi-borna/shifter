window._cur_id = 0;
window.inc_id = function() {
	return _cur_id++;
}

const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

window.pwd = path.dirname(process.mainModule.filename);

window.STOP_LISTENING = Symbol("Stop listening");

window.open_audio_file = async function (input_el, audio_context) {
	let file = fs.readFileSync(input_el.value);
	return audio_context.decodeAudioData(file.buffer);
}

window.copy_audio_buffer = function copy_audio_buffer(audio_buffer) {
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

window.copy_audio_buffer_with_channels = function copy_audio_buffer_with_channels(audio_buffer, channels) {
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

window.extend = function (target, source) {
	for (let prop in source) {
		target.prototype[prop] = source[prop];
	}
}

window.globalize = function (obj) {
	Object.assign(window, unwrap(obj));
}

window.prettify_number = function (num, places = 2) {
	return num.toFixed(places).replace(/(\.0+$)/, "").replace(/(\d*\.[^0]+)0+$/, "$1");
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
