import Utils from './utils.js';
import Multicall from './multicall.js'
import ky from 'https://cdnjs.cloudflare.com/ajax/libs/ky/0.20.0/index.min.js'

export class Posi {
    #contracts;
    #userAddress;
    #web3 //read only
    #multicall

    static POSI_API_URL = 'https://api.position.exchange/'

    static {
        this.currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 3
        });
        this.percentageFormatter = new Intl.NumberFormat('en-US', {
            style: 'percent',
            maximumFractionDigits: 2
        });
    }

    constructor() {
        this.#web3 = new Web3('https://bsc-dataseed.binance.org:443/')
        // this.#web3 = new Web3('https://bsc-dataseed1.ninicoin.io:443/')
        this.#multicall = new Multicall(this.#web3, '0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb')
        this.#initContracts()
    }

    get web3() {
        return this.#web3
    }

    get userAddress() {
        return this.#userAddress
    }

    get contracts() {
        return this.#contracts
    }

    get multicall() {
        return this.#multicall
    }
    
    uintToPrice(v) {
        return v / 10 ** 18
    }

    priceToUint256(v) {
        return (new this.#web3.utils.BN('10', 10)).pow(new this.#web3.utils.BN('18', 10)).mul(new this.#web3.utils.BN(v+'', 10)).toString(10, 64)
    }

    static roundCurrency(v, readable = false) {
        if(readable) {
            return this.currencyFormatter.format(v).replace('$', '');
        } else {
            return Utils.round(v, 3)
        }
    }

    async ethIsConnected() {
        return (await (window.ethereum.request({ method: 'eth_accounts' }))).length > 0
    }

    async ethEnabled(askIfNotConnected = true) {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum)
            if(askIfNotConnected && !await this.ethIsConnected()) {
                await window.ethereum.send('eth_requestAccounts')
            }
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }], // chainId must be in hexadecimal numbers
            })
  
            this.#userAddress = (await web3.eth.getAccounts())[0]

            return true
        }
        return false
    }

    async signAndSendTransaction(transaction, onConfirmation) {
        let params = [{
            from: this.#userAddress,
            to: transaction._parent._address,
            // gas: '0x76c0', // 30400
            // gasPrice: '0x9184e72a000', // 10000000000000
            // value: '0x9184e72a', // 2441406250
            data: transaction.encodeABI()
        }]

        let tx = await ethereum.request({
            method: 'eth_sendTransaction',
            params
        })
        
        return (async () => {
            let count = 0;
            let error = null;
            while(count++ < 180) {
                let receipt = await this.#web3.eth.getTransactionReceipt(tx, e => error = e)
                if(receipt) {
                    if(receipt.status) {
                        return null
                    } else {
                        return error
                    }
                }
                await Utils.wait(1000)
                console.log(`waiting transaction. count=${count}`)
            }
            throw 'Max query try on waiting transaction complete'
        })()
    }

    #initContracts() {
        this.#contracts = {
            posiTokenContract: new this.#web3.eth.Contract([{
                "name": "balanceOf",
                "inputs": [{"internalType": "address","name": "owner","type": "address"}],
                "outputs": [{"internalType": "uint256","name": "count","type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }], "0x5ca42204cdaa70d5c773946e69de942b85ca6706"),
            posiReferralContract: new this.#web3.eth.Contract([{
                "name":"getReferrer",
                "inputs":[{"internalType":"address","name":"_user","type":"address"}],
                "outputs":[{"internalType":"address","name":"address","type":"address"}],
                "stateMutability":"view",
                "type":"function"
            }], '0xfE2D545d214D51e8028947CFD15c9439D3DE3A33'),
            posiStakingContract: new this.#web3.eth.Contract([{
                "name":"pendingPosition",
                "inputs":[
                    {"internalType":"uint256","name":"_pid","type":"uint256"},
                    {"internalType":"address","name":"_user","type":"address"}
                ],
                "outputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"userInfo",
                "inputs":[
                    {"internalType":"uint256","name":"","type":"uint256"},
                    {"internalType":"address","name":"","type":"address"}
                ],
                "outputs":[
                    {"internalType":"uint256","name":"amount","type":"uint256"},
                    {"internalType":"uint256","name":"rewardDebt","type":"uint256"},
                    {"internalType":"uint256","name":"rewardLockedUp","type":"uint256"},
                    {"internalType":"uint256","name":"nextHarvestUntil","type":"uint256"}
                ],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"poolInfo",
                "inputs":[{"internalType":"uint256","name":"","type":"uint256"}],
                "outputs":[
                    {"internalType":"contract IERC20","name":"lpToken","type":"address"},
                    {"internalType":"uint256","name":"allocPoint","type":"uint256"},
                    {"internalType":"uint256","name":"lastRewardBlock","type":"uint256"},
                    {"internalType":"uint256","name":"accPositionPerShare","type":"uint256"},
                    {"internalType":"uint16","name":"depositFeeBP","type":"uint16"},
                    {"internalType":"uint256","name":"harvestInterval","type":"uint256"}
                ],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"deposit",
                "inputs":[
                    {"internalType":"uint256","name":"_pid","type":"uint256"},
                    {"internalType":"uint256","name":"_amount","type":"uint256"},
                    {"internalType":"address","name":"_referrer","type":"address"}
                ],
                "outputs":[],
                "stateMutability":"nonpayable",
                "type":"function"
            }], '0x0c54b0b7d61de871db47c3ad3f69feb0f2c8db0b'),
            nftStakingContract : new this.#web3.eth.Contract([{
                "name":"_harvestInterval",
                "inputs":[],
                "outputs":[{"internalType":"uint256","name":"interval","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name": "getPlayerIds",
                "inputs": [{"internalType": "address","name": "account","type": "address"}],
                "outputs": [{"internalType": "uint256[]","name": "tokenId","type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "name":"_degoBalances",
                "inputs":[{"internalType":"address","name":"","type":"address"}],
                "outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"_weightBalances",
                "inputs":[{"internalType":"address","name":"","type":"address"}],
                "outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"earned",
                "inputs":[{"internalType":"address","name":"account","type":"address"}],
                "outputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name":"_nextHarvestUntil",
                "inputs":[{"internalType":"address","name":"address","type":"address"}],
                "outputs":[{"internalType":"uint256","name":"timestamp","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name": "stake",
                "inputs": [{"internalType": "uint256","name": "gegoId","type": "uint256"}],
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "name": "unstake",
                "inputs": [{"internalType": "uint256","name": "gegoId","type": "uint256"}],
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "name": "harvest",
                "inputs": [],
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }], "0xbe9ff181bfa9dd78191b81b23fd4ff774a3fb4f1"),

            nftMarketContract : new this.#web3.eth.Contract([{
                "name":"markets",
                "inputs":[{"internalType":"uint256","name":"listingIds","type":"uint256"}],
                "outputs":[
                    {"internalType":"contract IERC721","name":"nft","type":"address"},
                    {"internalType":"uint256","name":"tokenId","type":"uint256"},
                    {"internalType":"uint256","name":"price","type":"uint256"},
                    {"internalType":"bool","name":"isSold","type":"bool"},
                    {"internalType":"address","name":"purchaser","type":"address"},
                    {"internalType":"address","name":"seller","type":"address"}
                ],
                "stateMutability":"view",
                "type":"function"
            }], '0x05E5b3CD263C4Cd40CFA74B5e221DbEDE60c632E'),
            nftTokenContract: new this.#web3.eth.Contract([{
                "name" : "tokensOfOwner",
                "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
                "outputs": [{"internalType": "uint256[]","name": "tokenId","type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "name":"safeTransferFrom",
                "inputs":[
                    {"internalType":"address","name":"from","type":"address"}
                    ,{"internalType":"address","name":"to","type":"address"}
                    ,{"internalType":"uint256","name":"tokenId","type":"uint256"}
                ],
                "outputs":[],
                "stateMutability":"nonpayable",
                "type":"function"
            }], "0xeca16df8d11d3a160ff7a835a8dd91e0ae296489"),
            nftFactoryContract : new this.#web3.eth.Contract([{
                "name":"_gegoId",
                "inputs":[],
                "outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
                "stateMutability":"view",
                "type":"function"
            },
            {
                "name": "_gegoes",
                "inputs": [{
                    "internalType": "uint256",
                    "name": "tokenId",
                    "type": "uint256"
                }],
                "outputs":[
                    {"internalType":"uint256","name":"id","type":"uint256"},
                    {"internalType":"uint256","name":"grade","type":"uint256"},
                    {"internalType":"uint256","name":"quality","type":"uint256"},
                    {"internalType":"uint256","name":"amount","type":"uint256"},
                    {"internalType":"uint256","name":"resBaseId","type":"uint256"},
                    {"internalType":"uint256","name":"tLevel","type":"uint256"},
                    {"internalType":"uint256","name":"ruleId","type":"uint256"},
                    {"internalType":"uint256","name":"nftType","type":"uint256"},
                    {"internalType":"address","name":"author","type":"address"},
                    {"internalType":"address","name":"erc20","type":"address"},
                    {"internalType":"uint256","name":"createdTime","type":"uint256"},
                    {"internalType":"uint256","name":"blockNum","type":"uint256"},
                    {"internalType":"uint256","name":"lockedDays","type":"uint256"}
                ],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "name": "burn",
                "inputs": [{"internalType": "uint256","name": "tokenId","type": "uint256"}],
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "name":"mint",
                "inputs":[
                    {
                        "components":[
                            {"internalType":"uint256","name":"amount","type":"uint256"},
                            {"internalType":"uint256","name":"resBaseId","type":"uint256"},
                            {"internalType":"uint256","name":"nftType","type":"uint256"},
                            {"internalType":"uint256","name":"ruleId","type":"uint256"},
                            {"internalType":"uint256","name":"tLevel","type":"uint256"}
                        ],
                        "internalType":"struct PosiNFTFactory.MintData",
                        "name":"mintData",
                        "type":"tuple"
                    }
                ],
                "outputs":[],
                "stateMutability":"nonpayable",
                "type":"function"
            }], '0x9D95b5eA6C8f678B7486Be7a6331ec10A54156BD')
        }
    }

    async getPriceInfo() {        
        let data = await ky.get(this.constructor.POSI_API_URL + `price/prices`).json()
        data.prices["PBOND_001"] = 10;
        return data.prices;
    }

    async getAddressInfo(address) {
        let data = await this.#multicall.call({
            address: address,
            balance: this.#contracts.posiTokenContract.methods.balanceOf(address),
            referrer: this.#contracts.posiReferralContract.methods.getReferrer(address),
            busdFarming: {
                userInfo: this.#contracts.posiStakingContract.methods.userInfo(0, address),
                pendingReward: this.#contracts.posiStakingContract.methods.pendingPosition(0, address),
                poolInfo: this.#contracts.posiStakingContract.methods.poolInfo(0)
            },
            bnbFarming: {
                userInfo: this.#contracts.posiStakingContract.methods.userInfo(2, address),
                pendingReward: this.#contracts.posiStakingContract.methods.pendingPosition(2, address),
                poolInfo: this.#contracts.posiStakingContract.methods.poolInfo(2)
            },
            nft: {
                harvestInterval: this.#contracts.nftStakingContract.methods._harvestInterval(),
                totalMiningPowerStaked: this.#contracts.nftStakingContract.methods._weightBalances(address),
                totalValue: this.#contracts.nftStakingContract.methods._degoBalances(address),
                pendingReward: this.#contracts.nftStakingContract.methods.earned(address),
                nextHarvestUntil: this.#contracts.nftStakingContract.methods._nextHarvestUntil(address),
                stakedTokenList: this.#contracts.nftStakingContract.methods.getPlayerIds(address),
                holdingTokenList: this.#contracts.nftTokenContract.methods.tokensOfOwner(address)
            },
            pbond001Pool: {
                userInfo: this.#contracts.posiStakingContract.methods.userInfo(3, address),
                pendingReward: this.#contracts.posiStakingContract.methods.pendingPosition(3, address),
                poolInfo: this.#contracts.posiStakingContract.methods.poolInfo(3)
            }
        })

        data.nft.stakedTokenList = data.nft.stakedTokenList.filter(x => x > 0)

        return data
    }

    async getNftData (tokenId) {
        let data = await this.#contracts.nftFactoryContract.methods._gegoes(tokenId).call()
        return data
    }

    async getNftList (addressInfo) {
        let tokenIdList = [...addressInfo.nft.holdingTokenList, ...addressInfo.nft.stakedTokenList]
        
        let marketHistory = null
        try {
            marketHistory = await ky.get(this.constructor.POSI_API_URL + `marketplace/myMarketHistory?address=${addressInfo.address}&perPage=10000&page=1`, {timeout:5000}).json()
        } catch(ex) {}
        let data = await this.#multicall.call(tokenIdList.map(tokenId => { return {
                tokenId: tokenId,
                isStaked: addressInfo.nft.holdingTokenList.indexOf(tokenId) === -1,
                data: this.#contracts.nftFactoryContract.methods._gegoes(tokenId)
            }
        }))

        return data.map(d => new PosiNFT(this, d.tokenId, d.isStaked, d.data, marketHistory ? marketHistory.data.rows.find(v => v.MarketListing.tokenId == d.tokenId && v.type == "purchase")?.MarketListing : []))
    }

    async stakeNFT(gegoId) {
        return this.signAndSendTransaction(this.#contracts.nftStakingContract.methods.stake(gegoId))
    }

    async safeTransferNFT(from, to, tokenId) {
        return this.signAndSendTransaction(this.#contracts.nftTokenContract.methods.safeTransferFrom(from, to, tokenId))
    }

    async unstakeNFT(gegoId) {
        return this.signAndSendTransaction(this.#contracts.nftStakingContract.methods.unstake(gegoId))
    }

    async decomposeNFT(tokenId) {
        return this.signAndSendTransaction(this.#contracts.nftFactoryContract.methods.burn(tokenId))
    }
    async castNFT(amount) {
        return this.signAndSendTransaction(this.#contracts.nftFactoryContract.methods.mint([this.priceToUint256(amount), 0, 0, 0, 0]))
    }

    async harvestBusdFarm(referrer) {
        return this.signAndSendTransaction(this.#contracts.posiStakingContract.methods.deposit(0, 0, referrer))
    }

    async harvestBnbFarm(referrer) {
        return this.signAndSendTransaction(this.#contracts.posiStakingContract.methods.deposit(2, 0, referrer))
    }
    
    async harvestPbond001Pool(referrer) {
        return this.signAndSendTransaction(this.#contracts.posiStakingContract.methods.deposit(3, 0, referrer))
    }    
    
    async harvestNftPool() {
        return this.signAndSendTransaction(this.#contracts.nftStakingContract.methods.harvest())
    }
}

export class PosiNFT {
    constructor (posi, tokenId, isStaked, gegoData, marketListingData = null) {
        this.amount = gegoData.amount
        this.author = gegoData.author
        this.blockNum = gegoData.blockNum
        this.createdTime = gegoData.createdTime
        this.erc20 = gegoData.erc20
        this.grade = gegoData.grade
        this.lockedDays = gegoData.lockedDays
        this.nftType = gegoData.nftType
        this.quality = gegoData.quality
        this.resBaseId = gegoData.resBaseId
        this.ruleId = gegoData.ruleId
        this.tLevel = gegoData.tLevel
        this.tokenId = tokenId
        this.isStaked = isStaked
        this.isDecomposed = gegoData.id == 0
        
            
        //compute
        this.amount = posi.uintToPrice(this.amount, 18)
        this.gradeTitle = PosiNFT.getGradeTitle(this.grade)
        this.efficiency = PosiNFT.getEfficiency(this.grade, this.quality)
        this.miningPower = PosiNFT.getMiningPower(this.grade, this.quality, this.amount)

        this.createdDate = Utils.timestampToDate(this.createdTime)
        this.unlockDate = Utils.dateAddDay(this.createdDate, this.lockedDays)

        this.buyPrice = marketListingData ? Utils.round(marketListingData.price,4) : null

        this.isBuyFromMarket = !!marketListingData

        this.isUnlocked = Date.now() > this.unlockDate
    }

    static getGradeTitle(grade) {
        switch (grade = ''.concat(grade)) {
          case '1':
            return 'Farmer'
          case '2':
            return 'Janitor'
          case '3':
            return 'Accountant'
          case '4':
            return 'Engineer'
          case '5':
            return 'Pilot'
          case '6':
            return 'Boss'
        }
    }

    static getEfficiency(grade, quality) {
        switch (grade = ''.concat(grade)) {
          case '1':
            return (1.1 + 0.1 * Number(quality) / 5000);
          case '2':
            return (1.2 + 0.1 * (Number(quality) - 5000) / 3000)
          case '3':
            return (1.3 + 0.1 * (Number(quality) - 8000) / 1000)
          case '4':
            return (1.4 + 0.2 * (Number(quality) - 9000) / 800)
          case '5':
            return (1.6 + 0.2 * (Number(quality) - 9800) / 180)
          case '6':
            return (1.8 + 0.2 * (Number(quality) - 9980) / 20)
        }

        return grade * 0.1 + 1 + 0.1 * quality
    }

    static getMiningPower(grade, quality, amount) {
        return this.getEfficiency(grade, quality) * amount
    }

    static getTotalAmount(nftList) {
        let total = 0
        nftList.map(n => total += n.amount)
        return total
    }
    static getTotalPaidAmount(nftList) {
        let total = 0
        nftList.map(n => total += n.isBuyFromMarket ? n.buyPrice : n.amount)
        return total
    }
    static getTotalMiningPower(nftList) {
        let total = 0
        nftList.map(n => total += n.miningPower)
        return total
    }

    static getTotalUnlockedAmount(nftList) {
        let total = 0
        let now = new Date()
        nftList.map(n => total += now >= n.unlockDate ? n.amount : 0)
        return total
    }
}