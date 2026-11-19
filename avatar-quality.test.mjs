import test from 'node:test';import assert from 'node:assert/strict';
import {preferAvatar} from './avatar-quality.mjs';
test('a later small thumbnail cannot downgrade the same profile image',()=>{
 const large='https://p3.douyinpic.com/aweme/1080x1080/aweme-avatar/same.jpeg';
 assert.equal(preferAvatar(large,'https://p26.douyinpic.com/aweme/100x100/aweme-avatar/same.jpeg'),large);
 const changed='https://p26.douyinpic.com/aweme/100x100/aweme-avatar/new.jpeg';assert.equal(preferAvatar(large,changed),changed);
});
