import {Posi, PosiNFT} from './js/posi.js'
import Utils from './js/utils.js'
import AppUtils from './js/app-utils.js'


export default class App () {
    constructor() {
        this.posi = new Posi();
        this.priceInfo = {};
        this.nftDataTable;
        this.addressInfo;

    }

    async start() {
        if(await posi.ethEnabled()) {
            $("#txtUserAddress").text(`${Utils.maskAddress(posi.userAddress)}`)
            this.nftDataTable = $("#posiNFT-table").DataTable({
                ajax: function (data, callback, settings) {
                    let customAddress = $("#txtCustomAddress").val().trim();
                    let address = customAddress ? customAddress : posi.userAddress
                    $(".current-address-span").text(address);

                    this.posi.getAddressInfo(address).then(addressInfo => {
                        this.posi.getNftList(addressInfo).then(nftList => {
                            $("#txtPosiBalance").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.balance), true) + " POSI" )

                            //busd posi farming
                            $("#txtBusdFarmingPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.pendingReward), true) + " POSI" )
                            $("#txtBusdFarmingStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.userInfo.amount), true))
                            let busdFarmingRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.busdFarming.userInfo.nextHarvestUntil))
                            $("#txtBusdFarmingRemainingTime").text(busdFarmingRemainingSeconds ? Utils.secondsToReadableTime(busdFarmingRemainingSeconds) : "NOW")

                            //nft pool
                            $("#txtNftPoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.pendingReward), true) + " POSI" )
                            $("#txtNftPoolStakedPower").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.totalMiningPowerStaked), true))
                            let nftPoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.nft.nextHarvestUntil))
                            $("#txtNftPoolRemainingTime").text(nftPoolRemainingSeconds ? Utils.secondsToReadableTime(nftPoolRemainingSeconds) : "NOW")
                            
                            //nft card list
                            let i = nftList.length
                            $("#txtNftTotalAmount").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.totalValue), true) + " POSI")
                            $("#txtNftTotalPaidAmount").text( Posi.roundCurrency(PosiNFT.getTotalPaidAmount(nftList), true) + " POSI")
                            $("#txtTotalUnlockedAmount").text( Posi.roundCurrency(PosiNFT.getTotalUnlockedAmount(nftList), true) + " POSI")
                            this.addressInfo = addressInfo
                            callback({data: nftList})
                            updatePriceInfo()
                        })
                    })
                },

                "columnDefs": [
                    {
                        "targets": "tokenIdCol",
                        "data": "tokenId"
                    }, {
                        "targets": "gradeTitleCol",
                        "data": "gradeTitle"
                    },
                    {
                        "targets": "gradeCol",
                        "data": "grade"
                    },
                    {
                        "targets": "sourceCol",
                        "data": d => d.isBuyFromMarket ? "Purchase" : "Cast"
                    },
                    {
                        "targets": "buyValueCol",
                        "data": d => d.buyPrice ? Posi.roundCurrency(d.buyPrice) : null
                    },
                    {
                        "targets": "parValueCol",
                        "data": d => Posi.roundCurrency(d.amount)
                    },
                    {
                        "targets": "miningPowerCol",
                        "data": d => Posi.roundCurrency(d.miningPower)
                    },
                    {
                        "targets": "efficiencyCol",
                        "data": "efficiency",
                        "render": v => Utils.toPercentage(v)
                    },
                    {
                        "targets": "unlockDateCol",
                        "data": "unlockDate",
                        "render" : v => {
                            if(v) {
                                return moment(v).format("YYYY-MM-DD HH:mm:ss")
                            }
                        }
                    },
                    {
                        "targets": "isStakedCol",
                        "data": "isStaked",
                        "render" : v => v ? "Staked" : "Holding"
                    },
                    {
                        "targets": "isUnlockedCol",
                        "data": "isUnlocked",
                        "render" : v => v ? "Decomposable" : "Locked"
                    },
                    {
                        "targets": "actionsCol",
                        "data": null,
                        "render" : (v, t, d) => {
                            let html = ''
                            if(v.isStaked) {
                                html += `<button type='button' class='btn btn-secondary' onclick='unstakeNFT(${d.tokenId})'>Unstake</button>`
                            } else {
                                html += `<button type='button' class='btn btn-primary' onclick='stakeNFT(${d.tokenId})'>Stake</button>`
                                if(v.isUnlocked) {
                                    html += `<button type='button' class='btn btn-warning' onclick='decomposeNFT(${d.tokenId})'>Decompose</button>`
                                }
                                html += `<button type='button' class='btn btn-danger' onclick='transferNFT(${d.tokenId})'>Transfer</button>`
                            }
                            return html
                        }
                    }
                ],
                "order": [[ 0, "desc" ]],
                "pageLength": 25

            })
        }
    }

    showCastedNFTResult(posiNFT) {
        return Swal.fire({
            title: `#${posiNFT.tokenId} Grade ${posiNFT.grade} ${posiNFT.gradeTitle}`,
            html: `
                <div><img src='https://app.position.exchange/img/${posiNFT.gradeTitle.toLowerCase()}.png' class='col-6' /><div>
                <div>Par: ${Posi.roundCurrency(posiNFT.amount, true)} POSI</div>
                <div>Mining Power: ${Posi.roundCurrency(posiNFT.miningPower, true)} POSI</div>
                <div>Efficiency: ${Utils.toPercentage(posiNFT.efficiency)}%</div>
                <div>Locked days: ${posiNFT.lockedDays} days</div>
            `
        })
    }

    updatePriceInfo() {
        $(".price-reflector").each(function () {
            let priceSrc = $($(this).data("priceSrc"))
            let priceSrcUnit = $(this).data("priceSrcUnit")
            let priceUnit = $(this).data("priceUnit")
    
            if(!priceUnit) {
                priceUnit = "BUSD"
            }
    
            let price = '-';
            
            try{
                let srcPrice = priceSrc.val() ? priceSrc.val() : priceSrc.text().replace(',', '')
                price = srcPrice * this.priceInfo[priceSrcUnit] / this.priceInfo[priceUnit]
            } catch(ex) {}
    
            $(this).text(Utils.isNumber(price) ? Utils.round(price) : '-');
        })
    }

    async startUpdatePriceLoop(waitMs = 60000) {
        while(true) {
            this.priceInfo = await this.posi.getPriceInfo()
            this.updatePriceInfo()
            await Utils.wait(waitMs)
        }
    }

    async unstakeNFT(tokenId) {
        let result = await AppUtils.showConfirm(`Unstake #${tokenId} ?`)
        if(result.isConfirmed) {
            try {
                await this.posi.unstakeNFT(tokenId)
                AppUtils.showSuccessToast(`#${tokenId} Unstaked`)
            } catch(ex) {
                AppUtils.showErrorToast(ex.message)
            }
            this.nftDataTable.ajax.reload( null, false )
        }
    }

    async stakeNFT(tokenId) {
        let result = await AppUtlis.showConfirm(`Stake #${tokenId} ?`)
        if(result.isConfirmed) {
            try {
                await this.posi.stakeNFT(tokenId)
                AppUtlis.showSuccessToast(`#${tokenId} staked`)
            } catch(ex) {
                AppUtlis.showErrorToast(ex.message)
            }
            this.nftDataTable.ajax.reload( null, false )
        }
    }
    
    async decomposeNFT(tokenId) {
        let result = await AppUtlis.showConfirm(`Decompose #${tokenId} ?`)
        if(result.isConfirmed) {
            let result2 = await AppUtlis.showConfirm(`Are you sure want to decompose #${tokenId} ?`)
            if(result2.isConfirmed) {
                try {
                    await this.posi.decomposeNFT(tokenId)
                    AppUtlis.showSuccessToast(`#${tokenId} decomposed`)
                } catch(ex) {
                    AppUtlis.showErrorToast(ex.message)
                }
                this.nftDataTable.ajax.reload( null, false )
            }
        }
    }
    
    async harvestBusdFarm() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.busdFarming.userInfo.nextHarvestUntil))
        if(remainSecond) {
            showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtlis.showConfirm(`Harvest BUSD Farm?`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestBusdFarm(addressInfo.referrer)
                    AppUtlis.showSuccessToast(`BUSD Farm harvested`)
                } catch (ex) {
                    AppUtlis.showErrorToast(ex.message)
                }
                this.nftDataTable.ajax.reload( null, false )
            }
        }
    }
    
    async harvestNftPool() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.nft.nextHarvestUntil))
        if(remainSecond) {
            AppUtlis.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtlis.showConfirm(`Harvest NFT Pool?`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestNftPool()
                    AppUtlis.showSuccessToast(`NFT Pool harvested`)
                } catch (ex) {
                    AppUtlis.showErrorToast(ex.message)
                }
                this.nftDataTable.ajax.reload( null, false )
            }
        }
    }
    
    async transferNFT(tokenId) {
        let to = prompt(`Transfer #${tokenId} to address:`)
        if(to && (await AppUtlis.showConfirm(`Confirm transfer #${tokenId} to ${to} ?`)).isConfirmed) {
            try{
                await this.posi.safeTransferNFT(posi.userAddress, to, tokenId)
                AppUtlis.showSuccessToast(`Transferred #${tokenId} to ${to}`)
            } catch(ex) {
                AppUtlis.showErrorToast(ex.message)
            }
    
            this.nftDataTable.ajax.reload( null, false )
        }
    }
    
    
    searchAddress() {
        this.nftDataTable.ajax.reload()
    }
    
    async castNFT(amount) {
        if(amount <= 0) {
            AppUtils.showError("Cast NFT amount must greater than zero!!!")
            return
        }
        if((await AppUtils.showConfirm(`Cast NFT with ${amount} POSI ?`)).isConfirmed) {
            try {
                await this.posi.castNFT(amount)
                let addressInfo = await this.posi.getAddressInfo(posi.userAddress)
                let nftList = await this.posi.getNftList(addressInfo)                          
                let maxTokenId = Math.max(...nftList.map(x=>x.tokenId))
                let castedNFT = nftList.find(x=>x.tokenId = maxTokenId)
                this.showCastedNFTResult(castedNFT)
            } catch (ex) {
                AppUtils.showErrorToast(ex.message)
            }
            this.nftDataTable.ajax.reload( null, false )
        }
    }
}

