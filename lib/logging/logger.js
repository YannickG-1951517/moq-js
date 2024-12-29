class Logger {
	static instance
	worker
	clientId

	constructor() {
		this.worker = new Worker(new URL("./loggerWorker.js", import.meta.url), { type: "module" })

		// this.worker.onmessage = (event) => {
		// 	console.log("Message from worker:", event.data)
		// }
	}

	static getInstance() {
		if (!Logger.instance) {
			Logger.instance = new Logger()
		}
		return Logger.instance
	}

	async logEvent(name, data) {
		const logEntry = {
			timestamp: new Date().toLocaleTimeString(),
			name,
			data,
		}
		this.worker.postMessage({
			type: "LOG_EVENT",
			payload: logEntry,
		})
	}
}

export { Logger }
