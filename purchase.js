var exports = module.exports = {};

const keywords = require("./keywords.json");
const words = keywords.words;
const wordmap = keywords.map;
const category_map = keywords.category_map;
const queue_map = keywords.queue_map;
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

  for(const purchase of allPurchases){
    for(const attr of purchase.attributes){
      init_array[queue_map[attr]].push(purchase);
    }
  }
  return init_array;
}

if(debug){
  let p = exports.purchase('kfc', 3, '11th nov','13005032');
  //tag(p);
  console.log(p.item);

  function set(){
    let init = [];
    for(i = 0; i < 5; i++){
      init.push(exports.purchase('kfc', 4, '11 nov', '13005032'));
    }
    return init;
  }
  console.log(exports.binPurchases(set()));
}