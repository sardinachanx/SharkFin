const DataPoint = require('data-point');
const XmlToJson = require('xml2js').parseString;

const APIS = ['macys', 'jcpenney', 'walmart', 'supermarket'];
const KEYS = {
  macys: '9m5dm82faq6s4t76sqxvd9k3',
  walmart: { apiKey: '5rjw69f2qeuvmcyr94tptvsd', lsPublisherId: 'li*LWdY/zkM' },
  supermarket: 'be0c879624'
};
const LOCATION = { city: 'New York', state: 'NY' };
const HABITS = ["premium", "alcohol", "vgaming", "fdout", "tobacco"]; 

function genMapKeys() {
  let json = {};
  for (let api of APIS)
    json[api] = '$..locals.apis[' + api + '] | control:' + api
  return { mapKeys: json };
}

function injectControlEntities(source) {
  for (let api of APIS) {
    source['control:' + api] = {
      select: [{
        case: '$use',
        do: 'transform:' + api
      },{
        default: () => null
      }]
    }
  }
  return source;
}

function genLocals(map) {
  let output = {};
  for (let api of APIS) {
    output[api] = {
      id: api,
      use: !!map[api]
    };
  }
  return output;
}

function attrToApis(attributes) {
  var map = {};
  if (~attributes.indexOf('grocery')) {
    map['walmart'] = true;
    map['supermarket'] = true;
  }
  if (~attributes.indexOf('clothing')) {
    map['macys'] = true;
    map['walmart'] = true;
    map['jcpenney'] = true;
  }
  if (~attributes.indexOf('travel')) {
    //TODO: Travel
  }
  return map;
}

function xmlRedux(acc) {
  return new Promise(function(resolve,reject) {
    XmlToJson(acc.value, (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });
}

const dataPoint = DataPoint.create({
  entities: injectControlEntities({
    'hash:GetApis': genMapKeys(),
    'transform:xml': xmlRedux,

    'transform:macys': ['request:macys', 'transform:normalizeMacys'],
    'request:macys': {
      url: 'https://api.macys.com/v4/catalog/search?searchphrase={locals.item}',
      options: { headers: { 'x-macys-webservice-client-id': KEYS.macys } }
    },
    'transform:normalizeMacys': (acc) => {
      let products = acc.value.searchresultgroups[0].products.product; 
      products.forEach(product => {
        if (product.finalPrice) product.actualCost = product.finalPrice.finalPrice;
        else if (product.price.sale) product.actualCost = product.price.sale.value;
        else if (product.price.current) product.actualCost = product.price.current.value;
        else product.actualCost = product.price.regular.value;
      });
      products = products.filter(product => product.summary.available && product.actualCost < acc.locals.priceMax);
      return products.map(product => { return {
        type: 'cheaper',
        link: product.summary.producturl,
        name: product.summary.name,
        company: 'Macy\'s',
        price: product.actualCost,
        image: product.image[0].imageurl,
      }});
    },

    'transform:jcpenney': ['request:jcpenney', 'transform:normalizeJcpenny'],
    'request:jcpenney': {
      url: 'http://api.jcpenney.com/v2/search?q={locals.item}&page=1',
      options: { headers: { 'X-Currency': 'USD' } }
    },
    'transform:normalizeJcpenny': (acc) => {
      let products = acc.value.products;
      products.forEach(product => {
        product.actualCost = Infinity;
        for (let price of product.prices) {
          let avgPrice = (price.max + price.min)/2;
          product.actualCost = Math.min(product.actualCost, avgPrice);
        }
      });
      products = products.filter(product => product.actualCost < acc.locals.priceMax);
      return products.map(product => { return {
        type: 'cheaper',
        link: product.links[0].href,
        name: product.name,
        company: 'JCPenney',
        price: product.actualCost,
        image: product.images[0].url
      }});
    },

    'transform:walmart': ['request:walmart', 'transform:normalizeWalmart'],
    'request:walmart': {
      url: "http://api.walmartlabs.com/v1/search?query={locals.item}",
      options: { qs: {
        apiKey: KEYS.walmart.apiKey,
        lsPublisherId: KEYS.walmart.lsPublisherId,
      }}
    },
    'transform:normalizeWalmart': (acc) => {
      let products = acc.value.items;
      products = products.filter(product => product.salePrice < acc.locals.priceMax);
      return products.map(product => { return {
        type: 'cheaper',
        link: product.productUrl,
        name: product.name,
        company: 'Walmart',
        price: product.salePrice,
        image: product.thumbnailImage
      }});
    },
    
    'transform:supermarket': [
      'request:supermarketStores', 'transform:xml', 'transform:getStores',
      'request:supermarketSearch[]', 'transform:xml[]', 'transform:normalizeSupermarket'
    ],
    'request:supermarketStores': {
      url: "http://www.supermarketapi.com/api.asmx/StoresByCityState",
      options: { qs: {
        APIKEY: KEYS.supermarket,
        SelectedState: LOCATION.state,
        SelectedCity: LOCATION.city
      }}
    },
    'transform:getStores': (acc) => {
      let stores = acc.value.ArrayOfStore.Store;
      stores = stores.filter((item, pos) => {
        return stores.findIndex(x => x.Storename[0] == item.Storename[0]) == pos;
      }).slice(0, 1);
      acc.locals.addressMap = {};
      let storeIds = [];
      for (let store of stores) {
        const id = store.StoreId[0];
        storeIds.push(id);
        const name = store.Storename[0];
        let address = '';
        address += store.Address[0] + ',\n';
        address += store.City[0] + ', ' + store.State;
        acc.locals.addressMap[id] = { name: name, address: address };
      }
      return storeIds;
    },
    'request:supermarketSearch': {
      url: "http://www.supermarketapi.com/api.asmx/COMMERCIAL_SearchForItem?StoreId={value}&ItemName={locals.item}",
      options: { qs: {
        APIKEY: KEYS.supermarket,
      } },
      after: (acc) => {
        return acc.value.replace(/<Product_Commercial>/g, '<Product_Commercial><StoreID>' + acc.initialValue + '</StoreID>') 
      }
    },
    'transform:normalizeSupermarket': (acc) => {
      let products = [];
      for (var store of acc.value)
        products = products.concat(store.ArrayOfProduct_Commercial.Product_Commercial);
      products.forEach(product => {
        const storeInfo = acc.locals.addressMap[product.StoreID[0]];
        product.storeName = storeInfo.name.trim();
        product.address = storeInfo.address;
        product.price = Number(product.Pricing[0]);
      });
      products = products.filter(product => product.price < acc.locals.priceMax);
      return products.map(product => { return {
        type: 'localcheaper',
        name: product.Itemname[0],
        company: product.storeName,
        image: product.ItemImage[0],
        price: product.price,
        address: product.address
      }});
    }
  })
})

let proc = (input) => {
  if (input.attributes.some(n => !!~HABITS.indexOf(n))) {
    return new Promise(done => {
      done({
        item: input.item,
        price: input.price,
        type: 'habit'
        //image: 
      });
    });
  }
  return dataPoint.transform('hash:GetApis', {}, {
    locals: {
      apis: genLocals(attrToApis(input.attributes)),
      priceMax: input.price,
      item: input.item
    }
  }).then(acc => {
    let finalData = [];
    for (let store of Object.keys(acc.value)) {
      if (acc.value[store]) finalData = finalData.concat(acc.value[store]);
    }
    finalData.sort((a, b) => a.price - b.price);
    return new Promise(done => {
      done(finalData.length === 0 ? undefined : {
        item: input.item,
        price: input.price,
        type: finalData[0].type,
        substitutes: finalData
      });
    });
  });
};

let multiproc = (inputs) => {
  return Promise.all(inputs.map(input => proc(input)));
};

/* EXAMPLE
multiproc([{
  item: 'Whole Milk',
  price: 2.79,
  attributes: ['grocery']
},{
  item: 'Black Bralette',
  price: 10,
  attributes: ['clothing']
},{
  item: 'Beer',
  price: 20,
  attributes: ['alcohol']
}]).then(x => console.dir(x, { depth: null }));
*/

module.exports = multiproc;
