const keywords = require("./keywords.json");
const words = keywords.words;
const wordmap = keywords.map;
const category_map = keywords.category_map;

//first tag indiv data, then tag again for long-term trends
function purchase(item, price, date, category){
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
        for(let id of Object.keys(category_map)){
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
let p = purchase('apples', 3, '11th nov','19047000');
//tag(p);
console.log(p);

module.exports = purchase;