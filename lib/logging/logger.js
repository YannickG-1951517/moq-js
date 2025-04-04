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

	async logEvent({ stream = "logging-stream", eventType, vantagePointID, data }) {
		this.worker.postMessage({
			eventType,
			vantagePointID,
			timestamp: Date.now(),
			stream,
			payload: data,
		})
	}
}

export { Logger }
