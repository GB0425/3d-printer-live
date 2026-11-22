export const NAMED_GIFTS = {
  heart: {label:'小心心', aliases:['爱心','红心'], count:1, size:'large', level:1, price:1},
  popularity: {label:'人气票', aliases:['红色人气票'], count:1, size:'large', level:1, price:1},
  rose: {label:'玫瑰', aliases:[], count:1, size:'large', level:1, price:1},
  beer: {label:'大啤酒', aliases:['啤酒'], count:2, size:'large', level:2, price:2},
  nice: {label:'你最好看', aliases:['你真好看'], count:2, size:'large', level:2, price:2},
  lollipop: {label:'棒棒糖', aliases:[], count:1, size:'huge', level:4, price:9},
  flower: {label:'鲜花', aliases:[], count:2, size:'huge', level:4, price:10},
  duck: {label:'加油鸭', aliases:[], count:3, size:'huge', level:4, price:15}
};

const names = new Map(Object.entries(NAMED_GIFTS).flatMap(([key,gift])=>
  [key,gift.label,...gift.aliases].map(name=>[name,key])
));

export function namedGiftKey(name) {
  return names.get(String(name ?? '').trim());
}

const giftIds = new Map([
  ['2001','heart'],['3992','popularity'],['855','popularity'],['463','rose'],
  ['2002','beer'],['3481','nice'],['165','lollipop'],['2006','flower'],['3597','duck']
]);

export function namedGiftLabelForId(id) {
  return NAMED_GIFTS[giftIds.get(String(id))]?.label;
}
