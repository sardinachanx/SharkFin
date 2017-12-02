const keywords = require("./keywords.json");
const words = keywords.words;
const wordmap = keywords.map;

//first tag indiv data, then tag again for long-term trends
function purchase(item, price, date, categories){
    let attributes = function(item, price, date, categories){
        let init = [];
        for (let type of Object.keys(words)) {
            for (let key of words[type]) {
                if (~item.indexOf(key)) {
                    console.log(item, key, type)
                    init.push(wordmap[type]);
                    break;
                }
            }
        }

        return init;
    };
    return{
        item: item,
        price: price,
        date: date,
        categories: categories,
        attributes: attributes(item, price, date, categories)
    }
}

let p = purchase('wine', 3000, '11th nov',[]);
//tag(p);
console.log(p);

