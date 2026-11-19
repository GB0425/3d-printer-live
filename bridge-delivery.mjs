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

  async replay(client, message, send, waitForCapacity) {
    if (client.replaying) return;
    client.replaying = true;
    try {
      let after = message.id === this.id && Number.isSafeInteger(message.after)
        ? Math.min(this.sequence, message.after) : client.startSequence;
      const restarted = !!message.id && message.id !== this.id;
      let announce = true;
      while (await waitForCapacity()) {
        const available = Math.max(this.roomStart, this.sequence - this.events.length);
        const missed = Math.max(0, available - Math.max(after, this.roomStart));
        if (announce || after < available) {
          after = Math.max(after, available);
          send({type:'event-stream', id:this.id, after, missed, restarted:announce && restarted});
          announce = false;
        }
        const through = Math.min(after + 128, this.sequence);
        while (after < through) send(this.events[after++ % this.events.length]);
        if (after === this.sequence) return;
      }
    } finally {
      client.replaying = false;
    }
  }
}
