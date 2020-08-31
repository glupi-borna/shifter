declare var JOB_RENDER: Symbol;
declare var JOB_FILTER: Symbol;
declare var new_job_signal: Signal<JobData>;
declare var JOB_KILLED: Symbol;

interface JobData {
	job_id: number;
	job_type: Symbol;
	job_discriminator?: any;
	is_running: boolean;
}

declare var job: (type: Symbol, discriminator?: any) => JobData;
declare var job_terminate: (job_data: JobData) => void;