import {Posi, PosiNFT} from './posi.js'
import Utils from './utils.js'
import AppUtils from './app-utils.js'


export default class App {
    constructor() {
        this.posi = new Posi();
        this.priceInfo = {};
        this.nftDataTable;
        this.addressInfo;
        this.ignoreNextUnstakedNftWarning = false
    }

    async start() {
        if(await this.posi.ethEnabled()) {
            $("#txtUserAddress").text(`${Utils.maskAddress(this.posi.userAddress)}`)

            $('#posiNFT-table thead tr').clone(true).addClass('filters').appendTo('#posiNFT-table thead');

            this.nftDataTable = $("#posiNFT-table").DataTable({
                orderCellsTop: true,
                
                initComplete: function () {
                    let api = this.api();
         
                    // For each column
                    api.columns().eq(0).each(function (colIdx) {
                        // Set the header cell to contain the input element
                        let cell = $('.filters th').eq(
                            $(api.column(colIdx).header()).index()
                        );
                        let title = $(cell).text();
                        if($(cell).hasClass("isStakedCol")) {
                            let select = $('<select>').addClass("form-control").css("width", "106px")
                            .append($('<option>').val("").text('-'))
                            .append($('<option>').val("Staked").text("Staked"))
                            .append($('<option>').val("Holding").text("Holding"))
                            $(cell).html("").append(select);
                        } else if($(cell).hasClass("isUnlockedCol")) {
                            let select = $('<select>').addClass("form-control").css("width", "106px")
                            .append($('<option>').val("").text('-'))
                            .append($('<option>').val("Locked").text("Locked"))
                            .append($('<option>').val("Unlocked").text("Unlocked"))
                            $(cell).html("").append(select);
                        } else if($(cell).hasClass("actionsCol")) {
                            $(cell).html("");
                        } else {
                            $(cell).html('<input type="text" class="form-control" placeholder="' + title + '" />');
                        }                            
        
                        // On every keypress in this input
                        $('input, select', $('.filters th').eq($(api.column(colIdx).header()).index()))
                            .off('keyup change')
                            .on('keyup change', function (e) {
                                e.stopPropagation();
        
                                // Get the search value
                                $(this).attr('title', $(this).val());
                                let regexr = '({search})'; //$(this).parents('th').find('select').val();
        
                                let cursorPosition = this.selectionStart;
                                // Search the column for that value
                                api.column(colIdx).search(
                                    this.value != ''
                                        ? regexr.replace('{search}', '(((' + this.value + ')))')
                                        : '',
                                    this.value != '',
                                    this.value == ''
                                ).draw();
        
                                $(this).focus()[0]?.setSelectionRange?.(cursorPosition, cursorPosition);
                            });
                    });
                },
                ajax: (data, callback, settings) => {
                    let customAddress = $("#txtCustomAddress").val().trim();
                    let address = customAddress ? customAddress : this.posi.userAddress
                    $(".current-address-span").text(address);

                    this.posi.getAddressInfo(address).then(addressInfo => {
                        this.posi.getNftList(addressInfo).then(nftList => {
                            $("#txtPosiBalance").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.balance), true))

                            //busd posi farming
                            $("#txtBusdFarmingPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.pendingReward), true))
                            $("#txtBusdFarmingStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.userInfo.amount), true))
                            let busdFarmingRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.busdFarming.userInfo.nextHarvestUntil))
                            $("#txtBusdFarmingRemainingTime").text(busdFarmingRemainingSeconds ? Utils.secondsToReadableTime(busdFarmingRemainingSeconds) : "NOW")

                            //bnb posi farming
                            $("#txtBnbFarmingPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.bnbFarming.pendingReward), true))
                            $("#txtBnbFarmingStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.bnbFarming.userInfo.amount), true))
                            let bnbFarmingRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.bnbFarming.userInfo.nextHarvestUntil))
                            $("#txtBnbFarmingRemainingTime").text(bnbFarmingRemainingSeconds ? Utils.secondsToReadableTime(bnbFarmingRemainingSeconds) : "NOW")

                            //nft pool
                            $("#txtNftPoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.pendingReward), true))
                            $("#txtNftPoolStakedPower").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.totalMiningPowerStaked), true))
                            let nftPoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.nft.nextHarvestUntil))
                            $("#txtNftPoolRemainingTime").text(nftPoolRemainingSeconds ? Utils.secondsToReadableTime(nftPoolRemainingSeconds) : "NOW")
                            
                            //nft card list
                            let i = nftList.length
                            $("#txtNftTotalAmount").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.totalValue), true))
                            $("#txtNftTotalPaidAmount").text( Posi.roundCurrency(PosiNFT.getTotalPaidAmount(nftList), true) + " POSI")
                            $("#txtTotalUnlockedAmount").text( Posi.roundCurrency(PosiNFT.getTotalUnlockedAmount(nftList), true))
                            this.addressInfo = addressInfo
                            callback({data: nftList})
                            this.updatePriceInfo()

                            let notStakedNftCount = nftList.filter(nft => !nft.isStaked).length
                            if(notStakedNftCount > 0 && !this.ignoreNextUnstakedNftWarning) {
                                this.showNotStakedWarning(notStakedNftCount)
                            }
                            this.ignoreNextUnstakedNftWarning = false
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
                        "render" : v => v ? "Unlocked" : "Locked"
                    },
                    {
                        "targets": "actionsCol",
                        "data": null,
                        "render" : (v, t, d) => {
                            let html = ''
                            if(v.isStaked) {
                                html += `<button type='button' class='btn btn-secondary' onclick='app.unstakeNFT(${d.tokenId})'>Unstake</button>`
                            } else {
                                html += `<button type='button' class='btn btn-primary' onclick='app.stakeNFT(${d.tokenId})'>Stake</button>`
                                if(v.isUnlocked) {
                                    html += `<button type='button' class='btn btn-warning' onclick='app.decomposeNFT(${d.tokenId})'>Decompose</button>`
                                }
                                html += `<button type='button' class='btn btn-danger' onclick='app.transferNFT(${d.tokenId})'>Transfer</button>`
                            }
                            return html
                        }
                    }
                ],
                "order": [[ 0, "desc" ]],
                "pageLength": 25
            })
        }

        this.startUpdatePriceLoop()
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

    showNotStakedWarning(notStakedCount) {
        this.Toast = Swal.fire({
            toast: true,
            position: 'bottom',
            icon: 'warning',
            confirmButtonText: "Go to",
            showCancelButton: true,
            cancelButtonText: "Dismiss",
            title: `${notStakedCount} NFT(s) not staked`,
        }).then(result => {
            if (result.isConfirmed) {
                $("input, select", "#posiNFT-table .filters").val("")
                $(".isStakedCol select", "#posiNFT-table .filters").val("Holding").change()
            }
        })
    }

    nftTableClearFilters() {
        $("input, select", "#posiNFT-table .filters").val("").change()
    }

    updatePriceInfo() {
        let self = this
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
                price = srcPrice * self.priceInfo[priceSrcUnit] / self.priceInfo[priceUnit]
            } catch(ex) {}
    
            $(this).text(Utils.isNumber(price) ? Utils.roundToReadable(price, 2) : '-');
        })
        $(".price-display").each(function () {
            let priceSrcUnit = $(this).data("priceSrcUnit")
            let priceSrcValue = $(this).data("priceSrcValue")
            let priceUnit = $(this).data("priceUnit")
            let priceDp = $(this).data("priceDp")
    
            if(!priceUnit) {
                priceUnit = "BUSD"
            }

            if(!priceDp) {
                priceDp = 2
            }
    
            let price = '-';
            
            try{
                let srcPrice = priceSrcValue
                price = srcPrice * self.priceInfo[priceSrcUnit] / self.priceInfo[priceUnit]
            } catch(ex) {}
    
            $(this).text(Utils.isNumber(price) ? Utils.roundToReadable(price, priceDp) : '-');
        })
    }

    async startUpdatePriceLoop(waitMs = 10000) {
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
            this.reload(false)
        }
    }

    async stakeNFT(tokenId) {
        let result = await AppUtils.showConfirm(`Stake #${tokenId} ?`)
        if(result.isConfirmed) {
            try {
                await this.posi.stakeNFT(tokenId)
                AppUtils.showSuccessToast(`#${tokenId} staked`)
            } catch(ex) {
                AppUtils.showErrorToast(ex.message)
            }
            this.reload(false)
        }
    }
    
    async decomposeNFT(tokenId) {
        let result = await AppUtils.showConfirm(`Decompose #${tokenId} ?`)
        if(result.isConfirmed) {
            let result2 = await AppUtils.showConfirm(`Are you sure want to decompose #${tokenId} ?`)
            if(result2.isConfirmed) {
                try {
                    await this.posi.decomposeNFT(tokenId)
                    AppUtils.showSuccessToast(`#${tokenId} decomposed`)
                } catch(ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }
    
    async harvestBusdFarm() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.busdFarming.userInfo.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest BUSD Farm?`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestBusdFarm(this.addressInfo.referrer)
                    AppUtils.showSuccessToast(`BUSD Farm harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }

    async harvestBnbFarm() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.bnbFarming.userInfo.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest BNB Farm?`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestBnbFarm(this.addressInfo.referrer)
                    AppUtils.showSuccessToast(`BNB Farm harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }
    
    async harvestNftPool() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.nft.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest NFT Pool?`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestNftPool()
                    AppUtils.showSuccessToast(`NFT Pool harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }
    
    async transferNFT(tokenId) {
        let to = prompt(`Transfer #${tokenId} to address:`)
        if(to && (await AppUtils.showConfirm(`Confirm transfer #${tokenId} to ${to} ?`)).isConfirmed) {
            try{
                await this.posi.safeTransferNFT(this.posi.userAddress, to, tokenId)
                AppUtils.showSuccessToast(`Transferred #${tokenId} to ${to}`)
            } catch(ex) {
                AppUtils.showErrorToast(ex.message)
            }
    
            this.reload(false)
        }
    }
    
    
    searchAddress() {
        this.nftDataTable.ajax.reload()
    }

    reload(reset, ignoreNextUnstakedNftWarning = false) {
        this.ignoreNextUnstakedNftWarning = ignoreNextUnstakedNftWarning
        if(reset) {
            this.nftDataTable.ajax.reload()
        } else {
            this.nftDataTable.ajax.reload( null, false )
        }
    }
    
    async castNFT(amount) {
        if(amount <= 0) {
            AppUtils.showError("Cast NFT amount must greater than zero!!!")
            return
        }
        if((await AppUtils.showConfirm(`Cast NFT with ${amount} POSI ?`)).isConfirmed) {
            try {
                await this.posi.castNFT(amount)
                let addressInfo = await this.posi.getAddressInfo(this.posi.userAddress)
                let nftList = await this.posi.getNftList(addressInfo)                          
                let maxTokenId = Math.max(...nftList.map(x=>x.tokenId))
                let castedNFT = nftList.find(x=>x.tokenId = maxTokenId)
                this.showCastedNFTResult(castedNFT)
            } catch (ex) {
                AppUtils.showErrorToast(ex.message)
            }
            this.reload(true, true)
        }
    }
}

