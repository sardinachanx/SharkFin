var exports = module.exports = {};

const keywords = require("./keywords.json");
const words = keywords.words;
const wordmap = keywords.map;
const category_map = keywords.category_map;
const queue_map = keywords.queue_map;
const threshold_map = keywords.threshold_map;
const debug = true;



//first tag indiv data, then tag again for long-term trends
exports.purchase = function(item, price, date, category){
  let attributes = function(item, price, date, category){
    let init = [];
    for (let type of Object.keys(words)) {
      for (let key of words[type]) {
        if (~item.indexOf(key)) {
          init.push(wordmap[type]);
          break;
        }
      }
    }
    let reversed = Object.keys(category_map).reverse();
    for(let id of reversed){
      if(category != null && category.startsWith(id) && !init.includes(category_map[id])){
        init.push(category_map[id]);
        break;
      }
    }
    return init;
  };
  return{
    item: item,
    price: price,
    date: date,
    category: category,
    attributes: attributes(item, price, date, category)
  }
}

exports.binPurchases = function (allPurchases){
  function init(length){
    init_array = [];
    for(i = 0; i < length; i++){
      init_array.push([]);
    }
    return init_array;
  }

  var init_array = init(Object.keys(queue_map).length);

  for(let purchase of allPurchases){
    for(let attr of purchase.attributes){
      init_array[queue_map[attr]].push(purchase);
    }
  }
  return init_array;
}

exports.isRecurrent = function(queue, label){
  var sum = 0.0;
  let currTime = Math.floor((new Date).getTime()/1000);
  let model = function(epoch_time, start_time){
    let days_elapsed = Math.floor((epoch_time - start_time)/(60*60*24));
    if(debug){
      console.log(label);
      console.log("start_time " + new Date(start_time * 1000) + " epoch_time " + new Date(epoch_time * 1000));
      console.log(days_elapsed);
    }
    if(days_elapsed <= 30){
      return 1;
    }
    return Math.pow(Math.E, -((days_elapsed - 30)/12));
  }
  for(let purchase of queue){
    sum += model(currTime, purchase.date);
  }
  console.log(sum/queue.length);
  return sum/queue.length > threshold_map[label];
}

if(debug){
  let p = exports.purchase('kfc', 30, '1506884160','13005032');
  //tag(p);
  console.log(p.item);

  let test_epoch_dates = [/*1512154560,*//*1511636160,*./*1510858560,*//*1510772160,*/1509562560,1509216960,1508612160,1505501760,1503255360];

  function set(){
    let init = [];
    for(i = 0; i < 5; i++){
      init.push(exports.purchase('steam', 4, test_epoch_dates[i], '19013001'));
    }
    return init;
  }
  //console.log(exports.binPurchases(set()));
  console.log(Object.keys(queue_map));
  console.log(exports.isRecurrent(exports.binPurchases(set())[2],Object.keys(queue_map)[2]))
}