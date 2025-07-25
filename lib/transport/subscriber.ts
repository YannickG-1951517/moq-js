import * as Control from "./control"
import { Queue, Watch } from "../common/async"
import { Objects } from "./objects"
import type { TrackReader, GroupReader, ObjectReader } from "./objects"
import { Logger } from "../logging/logger"

export class Subscriber {
	// Use to send control messages.
	#control: Control.Stream

	// Use to send objects.
	#objects: Objects

	// Announced broadcasts.
	#announce = new Map<string, AnnounceRecv>()
	#announceQueue = new Watch<AnnounceRecv[]>([])

	// Our subscribed tracks.
	#subscribe = new Map<bigint, SubscribeSend>()
	#subscribeNext = 0n

	constructor(control: Control.Stream, objects: Objects) {
		this.#control = control
		this.#objects = objects
	}

	announced(): Watch<AnnounceRecv[]> {
		return this.#announceQueue
	}

	async recv(msg: Control.Publisher) {
		if (msg.kind == Control.Msg.Announce) {
			Logger.getInstance().logEvent({
				eventType: "announce-received",
				vantagePointID: "SUBSCRIBER",
				stream: "logging-stream",
				data: {
					message: msg,
				},
			})
			console.log("announce message and sending to logger", msg)
			await this.recvAnnounce(msg)
		} else if (msg.kind == Control.Msg.Unannounce) {
			Logger.getInstance().logEvent({
				eventType: "unannounce-received",
				vantagePointID: "SUBSCRIBER",
				stream: "logging-stream",
				data: {
					message: msg,
				},
			})
			this.recvUnannounce(msg)
		} else if (msg.kind == Control.Msg.SubscribeOk) {
			Logger.getInstance().logEvent({
				eventType: "subscribe-ok-received",
				vantagePointID: "SUBSCRIBER",
				stream: "logging-stream",
				data: {
					kind: msg.kind,
					id: msg.id,
					expires: msg.expires,
				},
			})
			this.recvSubscribeOk(msg)
		} else if (msg.kind == Control.Msg.SubscribeError) {
			Logger.getInstance().logEvent({
				eventType: "subscribe-error-received",
				vantagePointID: "SUBSCRIBER",
				stream: "logging-stream",
				data: {
					error: msg,
				},
			})
			await this.recvSubscribeError(msg)
		} else if (msg.kind == Control.Msg.SubscribeDone) {
			Logger.getInstance().logEvent({
				eventType: "subscribe-done-received",
				vantagePointID: "SUBSCRIBER",
				stream: "logging-stream",
				data: {
					message: msg,
				},
			})
			await this.recvSubscribeDone(msg)
		} else {
			throw new Error(`unknown control message`) // impossible
		}
	}

	async recvAnnounce(msg: Control.Announce) {
		console.log("announce message and sending to logger", msg)
		if (this.#announce.has(msg.namespace)) {
			throw new Error(`duplicate announce for namespace: ${msg.namespace}`)
		}
		Logger.getInstance().logEvent({
			eventType: "announce-ok-sent",
			vantagePointID: "SUBSCRIBER",
			stream: "logging-stream",
			data: {
				message: msg,
			},
		})

		await this.#control.send({ kind: Control.Msg.AnnounceOk, namespace: msg.namespace })

		const announce = new AnnounceRecv(this.#control, msg.namespace)
		this.#announce.set(msg.namespace, announce)

		this.#announceQueue.update((queue) => [...queue, announce])
	}

	recvUnannounce(_msg: Control.Unannounce) {
		throw new Error(`TODO Unannounce`)
	}

	async subscribe(namespace: string, track: string) {
		const id = this.#subscribeNext++

		const subscribe = new SubscribeSend(this.#control, id, namespace, track)
		this.#subscribe.set(id, subscribe)

		await this.#control.send({
			kind: Control.Msg.Subscribe,
			id,
			trackId: id,
			namespace,
			name: track,
			location: {
				mode: "latest_group",
			},
		})
		console.log("subscribe message and sending to logger", track, namespace)
		Logger.getInstance().logEvent({
			eventType: "subscribe-sent",
			vantagePointID: "SUBSCRIBER",
			stream: "logging-stream",
			data: {
				id: id,
				track: track,
				namespace: namespace,
			},
		})

		return subscribe
	}

	recvSubscribeOk(msg: Control.SubscribeOk) {
		const subscribe = this.#subscribe.get(msg.id)
		if (!subscribe) {
			throw new Error(`subscribe ok for unknown id: ${msg.id}`)
		}

		subscribe.onOk()
	}

	async recvSubscribeError(msg: Control.SubscribeError) {
		const subscribe = this.#subscribe.get(msg.id)
		if (!subscribe) {
			throw new Error(`subscribe error for unknown id: ${msg.id}`)
		}

		await subscribe.onError(msg.code, msg.reason)
	}

	async recvSubscribeDone(msg: Control.SubscribeDone) {
		const subscribe = this.#subscribe.get(msg.id)
		if (!subscribe) {
			throw new Error(`subscribe error for unknown id: ${msg.id}`)
		}

		await subscribe.onError(msg.code, msg.reason)
	}

	async recvObject(reader: TrackReader | GroupReader | ObjectReader) {
		const subscribe = this.#subscribe.get(reader.header.track)
		if (!subscribe) {
			throw new Error(`data for for unknown track: ${reader.header.track}`)
		}

		await subscribe.onData(reader)
	}
}

export class AnnounceRecv {
	#control: Control.Stream

	readonly namespace: string

	// The current state of the announce
	#state: "init" | "ack" | "closed" = "init"

	constructor(control: Control.Stream, namespace: string) {
		this.#control = control // so we can send messages
		this.namespace = namespace
	}

	// Acknowledge the subscription as valid.
	async ok() {
		if (this.#state !== "init") return
		this.#state = "ack"
		console.log("announce ok and sending to logger", this.namespace)
		Logger.getInstance().logEvent({
			eventType: "announce-ok-sent",
			vantagePointID: "SUBSCRIBER",
			stream: "logging-stream",
			data: {
				namespace: this.namespace,
			},
		})
		// Send the control message.
		return this.#control.send({ kind: Control.Msg.AnnounceOk, namespace: this.namespace })
	}

	async close(code = 0n, reason = "") {
		if (this.#state === "closed") return
		this.#state = "closed"

		return this.#control.send({ kind: Control.Msg.AnnounceError, namespace: this.namespace, code, reason })
	}
}

export class SubscribeSend {
	#control: Control.Stream
	#id: bigint

	readonly namespace: string
	readonly track: string

	// A queue of received streams for this subscription.
	#data = new Queue<TrackReader | GroupReader | ObjectReader>()

	constructor(control: Control.Stream, id: bigint, namespace: string, track: string) {
		this.#control = control // so we can send messages
		this.#id = id
		this.namespace = namespace
		this.track = track
	}

	async close(_code = 0n, _reason = "") {
		// TODO implement unsubscribe
		// await this.#inner.sendReset(code, reason)
	}

	onOk() {
		// noop
	}

	async onError(code: bigint, reason: string) {
		if (code == 0n) {
			return await this.#data.close()
		}

		if (reason !== "") {
			reason = `: ${reason}`
		}

		const err = new Error(`SUBSCRIBE_ERROR (${code})${reason}`)
		return await this.#data.abort(err)
	}

	async onData(reader: TrackReader | GroupReader | ObjectReader) {
		if (!this.#data.closed()) await this.#data.push(reader)
	}

	// Receive the next a readable data stream
	async data() {
		// Logger.getInstance().logEvent("subscribe", {
		// 	track: this.track,
		// })
		return await this.#data.next()
	}
}
