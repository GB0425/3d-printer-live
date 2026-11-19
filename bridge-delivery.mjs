import { randomUUID } from 'node:crypto';

export class BridgeDelivery {
  constructor(capacity = 16000) {
    this.id = randomUUID();
    this.events = new Array(capacity);
    this.sequence = 0;
    this.roomStart = 0;
  }

  record(event) {
    const sequence = ++this.sequence;
    const message = {...event, delivery:{id:this.id, sequence}};
    this.events[(sequence-1)%this.events.length] = message;
    return message;
  }

  switchRoom() {
    this.roomStart = this.sequence;
    this.events.fill(undefined);
  }

  resume(client, message, send) {
    const through = this.sequence;
    const requested = message.id === this.id && Number.isSafeInteger(message.after)
      ? Math.min(through, message.after) : client.startSequence;
    const available = Math.max(this.roomStart, through-this.events.length);
    const after = Math.max(requested, available);
    send({type:'event-stream', id:this.id, after,
      missed:Math.max(0, available-Math.max(requested, this.roomStart)),
      restarted:!!message.id && message.id!==this.id});
    for(let sequence=after+1; sequence<=through; sequence++){
      send(this.events[(sequence-1)%this.events.length]);
    }
  }
}
