class Logger {
	static instance
	worker
	clientId

	constructor() {
		this.worker = new Worker(new URL("./loggerWorker.js", import.meta.url), { type: "module" })
	}

	static getInstance() {
		if (!Logger.instance) {
			Logger.instance = new Logger()
		}
		return Logger.instance
	}

	async logEvent({ stream = "logging-stream", eventType, data }) {
		this.worker.postMessage({
			stream,
			eventType,
			timestamp: new Date().toISOString(),
			payload: data,
		})
		// console.log({
		// 	stream,
		// 	eventType,
		// 	timestamp: new Date().toISOString(),
		// 	payload: data,
		// })
	}
}

export { Logger }
