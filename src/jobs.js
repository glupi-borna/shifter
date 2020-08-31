window.JOB_RENDER = Symbol("Render Job");
window.JOB_FILTER = Symbol("Filter Job");
window.new_job_signal = new Signal();
window.JOB_KILLED = Symbol("Job Killed");

window.job = function (type, discriminator) {
	let new_job = {
		job_id: inc_id(),
		job_type: type,
		job_discriminator: discriminator,
		is_running: true
	};

	new_job_signal.emit(new_job);

	new_job_signal.subscribe((job) => {
		if (job === new_job) {
			return Signal.UNSUB;
		}

		if (job.job_type === new_job.job_type &&
			job.job_discriminator === new_job.job_discriminator &&
			job.job_id > new_job.job_id) {
			new_job.is_running = false;
			return Signal.UNSUB;
		}

		return undefined;
	});

	return new_job;
};

window.job_terminate = function(job_data) {
	new_job_signal.emit(job_data);
}