export default class Multicall {
    constructor(web3, contractAddress) {
        this.web3 = web3
        this.contract = new this.web3.eth.Contract([{
            "inputs":[
                {
                    "components":[
                    {
                        "internalType":"address",
                        "name":"target",
                        "type":"address"
                    },
                    {
                        "internalType":"bytes",
                        "name":"callData",
                        "type":"bytes"
                    }
                    ],
                    "internalType":"struct Multicall.Call[]",
                    "name":"calls",
                    "type":"tuple[]"
                }
            ],
            "name":"aggregate",
            "outputs":[
                {
                    "internalType":"uint256",
                    "name":"blockNumber",
                    "type":"uint256"
                },
                {
                    "internalType":"bytes[]",
                    "name":"returnData",
                    "type":"bytes[]"
                }
            ],
            "stateMutability":"nonpayable",
            "type":"function"
        }], contractAddress)
    }

    async call(input, splitNum = 1000) {
        let flattenInput = this.#flattenObject(input)
        
        let methodKeyList = Object.keys(flattenInput).filter((key, index) => {
            return typeof flattenInput[key].encodeABI === 'function'
        })
        let methodList = methodKeyList.map(key => flattenInput[key])
        let calls = methodList.map(method => {
            return [
                method._parent._address,
                method.encodeABI()
            ]
        })

        let callArray = [];

        if(splitNum) {
            while( calls.length ) {
                callArray.push( calls.splice(0, splitNum) );
            }
        } else {
            callArray = [calls]
        }

        let returnedDataArray = await Promise.all(callArray.map(c => {
            return this.contract.methods.aggregate(c).call()
        }))
        let returnData = returnedDataArray.map(x => {
            return x.returnData
        }).flat(1)


        // let {returnData} = await this.contract.methods.aggregate(calls).call()
        let decodedData = returnData.map((encodedHex, index) => {
            let method = methodList[index]
            let decoded = this.web3.eth.abi.decodeParameters(method._method.outputs, encodedHex);

            let outputList = method._method.outputs.map(x => x.name)
            let output = Object.filter(decoded,
                (value, key) => method._method.outputs.findIndex(x => x.name == key) === -1
            )
            return outputList.length == 1 ?  output[outputList[0]]: output
        })
        
        methodKeyList.map((key, index) => {
            let data = decodedData[index]
            this.#assignToFlattenKey(input, key, data)
        })

        return input;
    }

    #assignToFlattenKey(ob, key, value) {
        let i = key.indexOf('.')
        if(i === -1) {
            ob[key] = value
        } else {
            let k = key.slice(0, i)
            let rk = key.slice(i+1)
            this.#assignToFlattenKey(ob[k], rk, value)
        }
    }

    #flattenObject(ob) {
        let toReturn = {};
    
        for (let i in ob) {
            if (!ob.hasOwnProperty(i)) continue;
    
            if ((typeof ob[i]) == 'object' && ob[i] !== null &&  typeof ob[i].encodeABI !== 'function') {
                let flatObject = this.#flattenObject(ob[i]);
                for (let x in flatObject) {
                    if (!flatObject.hasOwnProperty(x)) continue;
    
                    toReturn[i + '.' + x] = flatObject[x];
                }
            } else {
                toReturn[i] = ob[i];
            }
        }
        return toReturn;
    }
}