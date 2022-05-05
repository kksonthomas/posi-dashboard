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

    #retrieveAddressFromQueryString() {
        let addressPair = window.location.search.slice(1).split("&").map(x => x.split("=")).find(x => x[0].toLowerCase() == 'address')
        if(addressPair) {
            console.log(addressPair[1])
            return addressPair[1]
        } else {
            return null
        }
    }

    async connectMetamask(askIfNotConnected) {
        if(await this.posi.ethEnabled(askIfNotConnected) && await this.posi.ethIsConnected()) {
            $("#txtUserAddress").text(`${Utils.maskAddress(this.posi.userAddress)}`)
            this.updateLocalReferrer()
            await this.updateEthConnectRequiredUIs()
            this.reload(true)
        }
    }

    async updateEthConnectRequiredUIs() {
        if(await this.posi.ethIsConnected()) {
            $(".display-on-eth-connected").show()
            $(".display-on-eth-not-connected").hide()
        } else {
            $(".display-on-eth-connected").hide()
            $(".display-on-eth-not-connected").show()
        }

        if(this.#isOwningCurrentAddress()) {
            $(".display-on-owning-address").show()
        } else {
            $(".display-on-owning-address").hide()
        }
    }

    async start() {
        let app = this
        await this.connectMetamask(false)
        await this.updateEthConnectRequiredUIs();
        let targetAddress = this.#retrieveAddressFromQueryString()
        if(targetAddress) {
            $("#txtCustomAddress").val(targetAddress)
        }
        // if(await this.posi.ethEnabled()) {
        //     $("#txtUserAddress").text(`${Utils.maskAddress(this.posi.userAddress)}`)
        //     this.updateLocalReferrer()

            $('#posiNFT-table thead tr').clone(true).addClass('filters').appendTo('#posiNFT-table thead');
            this.nftDataTable = $("#posiNFT-table").DataTable({
                orderCellsTop: true,
                // searching: false,
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
                            .append($('<option>').val("Locking").text("Locking"))
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
                        //referrer settings
                        if(address == this.posi.userAddress && !localStorage.getItem('referrer')) {
                            this.updateLocalReferrer(addressInfo.referrer)
                        }

                        this.posi.getNftList(addressInfo).then(nftList => {
                            $("#txtPosiBalance").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.balance), true))

                            //vaults 
                            $("#txtPosiBNBVaultBalance").text(Posi.roundCurrency(this.posi.uintToPrice(addressInfo.posiBnbVault.userInfo.pendingRewards) * this.priceInfo.POSI, true))
                            $("#txtPosiBusdVaultBalance").text(Posi.roundCurrency(this.posi.uintToPrice(addressInfo.posiBusdVault.userInfo.pendingRewards) * this.priceInfo.POSI, true))
                            
                            //busd posi farming
                            $("#txtBusdFarmingPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.pendingReward), true))
                            $("#txtBusdFarmingStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.busdFarming.userInfo.amount), true))
                            let busdFarmingRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.busdFarming.userInfo.nextHarvestUntil))
                            $("#txtBusdFarmingRemainingTime").text(busdFarmingRemainingSeconds ? Utils.secondsToReadableTime(busdFarmingRemainingSeconds) : "NOW")
                            let busdDailyROI = null
                            let busdLastHarvestPassedSeconds = 0
                            if(this.priceInfo) {
                                let busdPendingRewardPercentage = this.posi.uintToPrice(addressInfo.busdFarming.pendingReward) * this.priceInfo["POSI"] / this.posi.uintToPrice(addressInfo.busdFarming.userInfo.amount) / this.priceInfo["POSI_BUSD_LP"]
                                busdLastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.busdFarming.userInfo.nextHarvestUntil - addressInfo.busdFarming.poolInfo.harvestInterval)
                                busdDailyROI = busdPendingRewardPercentage / busdLastHarvestPassedSeconds * 86400
                            }
                            $("#txtBusdFarmingDailyROI").text(busdDailyROI ? `~${Utils.toPercentage(busdDailyROI)}%` : "-")
                            $("#txtBusdFarmingSinceLastHarvest").text(busdDailyROI ? `${Utils.secondsToReadableTime(busdLastHarvestPassedSeconds)}` : "-")

                            //bnb posi farming
                            $("#txtBnbFarmingPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.bnbFarming.pendingReward), true))
                            $("#txtBnbFarmingStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.bnbFarming.userInfo.amount), true))
                            let bnbFarmingRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.bnbFarming.userInfo.nextHarvestUntil))
                            $("#txtBnbFarmingRemainingTime").text(bnbFarmingRemainingSeconds ? Utils.secondsToReadableTime(bnbFarmingRemainingSeconds) : "NOW")
                            $("#txtBnbFarmingRemainingTime").text(bnbFarmingRemainingSeconds ? Utils.secondsToReadableTime(bnbFarmingRemainingSeconds) : "NOW")
                            let bnbDailyROI = null
                            let bnbLastHarvestPassedSeconds = 0
                            if(this.priceInfo) {
                                let bnbPendingRewardPercentage = this.posi.uintToPrice(addressInfo.bnbFarming.pendingReward) * this.priceInfo["POSI"] / this.posi.uintToPrice(addressInfo.bnbFarming.userInfo.amount) / this.priceInfo["POSI_BNB_LP"]
                                bnbLastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.bnbFarming.userInfo.nextHarvestUntil - addressInfo.bnbFarming.poolInfo.harvestInterval)
                                bnbDailyROI = bnbPendingRewardPercentage / bnbLastHarvestPassedSeconds * 86400
                            }
                            $("#txtBnbFarmingDailyROI").text(bnbDailyROI ? `~${Utils.toPercentage(bnbDailyROI)}%` : "-")
                            $("#txtBnbFarmingSinceLastHarvest").text(bnbDailyROI ? `${Utils.secondsToReadableTime(bnbLastHarvestPassedSeconds)}` : "-")

                            //nft pool
                            $("#txtNftPoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.pendingReward), true))
                            $("#txtNftPoolStakedPower").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.nft.totalMiningPowerStaked), true))
                            let nftPoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.nft.nextHarvestUntil))
                            $("#txtNftPoolRemainingTime").text(nftPoolRemainingSeconds ? Utils.secondsToReadableTime(nftPoolRemainingSeconds) : "NOW")
                            let nftPendingRewardPercentage = this.posi.uintToPrice(addressInfo.nft.pendingReward) / this.posi.uintToPrice(addressInfo.nft.totalMiningPowerStaked)
                            let nftLastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.nft.nextHarvestUntil - addressInfo.nft.harvestInterval)
                            let nftDailyROI = nftPendingRewardPercentage / nftLastHarvestPassedSeconds * 86400
                            $("#txtNftPoolDailyROI").text(`~${Utils.toPercentage(nftDailyROI)}%`)
                            $("#txtNftPoolSinceLastHarvest").text(nftDailyROI ? `${Utils.secondsToReadableTime(nftLastHarvestPassedSeconds)}` : "-")

                            //pbond pool
                            $("#txtPbond001PoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond001Pool.pendingReward), true))
                            $("#txtPbond001PoolStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond001Pool.userInfo.amount), true))
                            let pbond001PoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.pbond001Pool.userInfo.nextHarvestUntil))
                            $("#txtPbond001PoolRemainingTime").text(pbond001PoolRemainingSeconds ? Utils.secondsToReadableTime(pbond001PoolRemainingSeconds) : "NOW")
                            let pbond001DailyROI = null
                            let pbond001LastHarvestPassedSeconds = 0
                            if(this.priceInfo) {
                                let pbond001PendingRewardPercentage = this.posi.uintToPrice(addressInfo.pbond001Pool.pendingReward) * this.priceInfo["POSI"] / this.posi.uintToPrice(addressInfo.pbond001Pool.userInfo.amount) / this.priceInfo["PBOND_001"]
                                pbond001LastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.pbond001Pool.userInfo.nextHarvestUntil - addressInfo.pbond001Pool.poolInfo.harvestInterval)
                                pbond001DailyROI = pbond001PendingRewardPercentage / pbond001LastHarvestPassedSeconds * 86400
                            }
                            $("#txtPbond001PoolDailyROI").text(pbond001DailyROI ? `~${Utils.toPercentage(pbond001DailyROI)}%` : "-")
                            $("#txtPbond001PoolSinceLastHarvest").text(pbond001DailyROI ? `${Utils.secondsToReadableTime(pbond001LastHarvestPassedSeconds)}` : "-")

                            //pbond pool
                            $("#txtPbond002PoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond002Pool.pendingReward), true))
                            $("#txtPbond002PoolStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond002Pool.userInfo.amount), true))
                            let pbond002PoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.pbond002Pool.userInfo.nextHarvestUntil))
                            $("#txtPbond002PoolRemainingTime").text(pbond002PoolRemainingSeconds ? Utils.secondsToReadableTime(pbond002PoolRemainingSeconds) : "NOW")
                            let pbond002DailyROI = null
                            let pbond002LastHarvestPassedSeconds = 0
                            if(this.priceInfo) {
                                let pbond002PendingRewardPercentage = this.posi.uintToPrice(addressInfo.pbond002Pool.pendingReward) * this.priceInfo["POSI"] / this.posi.uintToPrice(addressInfo.pbond002Pool.userInfo.amount) / this.priceInfo["PBOND_002"]
                                pbond002LastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.pbond002Pool.userInfo.nextHarvestUntil - addressInfo.pbond002Pool.poolInfo.harvestInterval)
                                pbond002DailyROI = pbond002PendingRewardPercentage / pbond002LastHarvestPassedSeconds * 86400
                            }
                            $("#txtPbond002PoolDailyROI").text(pbond002DailyROI ? `~${Utils.toPercentage(pbond002DailyROI)}%` : "-")
                            $("#txtPbond002PoolSinceLastHarvest").text(pbond002DailyROI ? `${Utils.secondsToReadableTime(pbond002LastHarvestPassedSeconds)}` : "-")

                            //pbond pool
                            $("#txtPbond003PoolPendingReward").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond003Pool.pendingReward), true))
                            $("#txtPbond003PoolStakedLPs").text( Posi.roundCurrency(this.posi.uintToPrice(addressInfo.pbond003Pool.userInfo.amount), true))
                            let pbond003PoolRemainingSeconds = Utils.getRemainingSeconds(Utils.timestampToDate(addressInfo.pbond003Pool.userInfo.nextHarvestUntil))
                            $("#txtPbond003PoolRemainingTime").text(pbond003PoolRemainingSeconds ? Utils.secondsToReadableTime(pbond003PoolRemainingSeconds) : "NOW")
                            let pbond003DailyROI = null
                            let pbond003LastHarvestPassedSeconds = 0
                            if(this.priceInfo) {
                                let pbond003PendingRewardPercentage = this.posi.uintToPrice(addressInfo.pbond003Pool.pendingReward) * this.priceInfo["POSI"] / this.posi.uintToPrice(addressInfo.pbond003Pool.userInfo.amount) / this.priceInfo["PBOND_003"]
                                pbond003LastHarvestPassedSeconds = Utils.currentTimestamp() - (addressInfo.pbond003Pool.userInfo.nextHarvestUntil - addressInfo.pbond003Pool.poolInfo.harvestInterval)
                                pbond003DailyROI = pbond003PendingRewardPercentage / pbond003LastHarvestPassedSeconds * 86400
                            }
                            $("#txtPbond003PoolDailyROI").text(pbond003DailyROI ? `~${Utils.toPercentage(pbond003DailyROI)}%` : "-")
                            $("#txtPbond003PoolSinceLastHarvest").text(pbond003DailyROI ? `${Utils.secondsToReadableTime(pbond003LastHarvestPassedSeconds)}` : "-")

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


                            //charts
                            let timestampNow = Date.now() / 1000
                            let todayString = Utils.datetimeToDate(new Date())
                            let maxUnlockTimestamp = Math.max(...nftList.map(n => n.unlockDate)) / 1000
                            let maxUnlockDate = Utils.dateAddDay(new Date(maxUnlockTimestamp * 1000), 1)
                            let maxUnlockDateString = Utils.datetimeToDate(maxUnlockDate)
                            let currentDateString = todayString;
                            let currentDate = new Date()
                            let chartNftUnlockedValueLabels = []
                            let chartNftUnlockedValueData = []
                            if(timestampNow < maxUnlockTimestamp) {
                                while(currentDateString != maxUnlockDateString) {
                                    currentDateString = Utils.datetimeToDate(currentDate)
                                    chartNftUnlockedValueLabels.push(currentDateString)
                                    let sumAmt = 0
                                    nftList.map(n =>  sumAmt += n.unlockDate < currentDate.getTime() ? n.amount : 0)
                                    chartNftUnlockedValueData.push(sumAmt)
                                    currentDate.setDate(currentDate.getDate()+1)
                                }
                            } else {
                                chartNftUnlockedValueLabels.push(todayString)
                                let sumAmt = 0
                                nftList.map(n => sumAmt += n.amount)
                                chartNftUnlockedValueData.push(sumAmt)
                            }

                            if(!window.chartjsNftUnlockedValue) {
                                window.chartjsNftUnlockedValue = new Chart(document.getElementById('chartNftUnlockedValue').getContext('2d'), {
                                    type: 'line',
                                    data: {
                                        labels: [],
                                        datasets: [{
                                            label: 'Total Unlocked Value @ date',
                                            data: [],
                                            borderColor: ['rgba(255, 255, 255, 1)'],
                                            backgroundColor:  ['rgba(255, 255, 255, 0.5)'],
                                        }]
                                    },
                                    options: {
                                        scales: {
                                            y: {
                                                beginAtZero: false
                                            }
                                        }
                                    }
                                });
                            }
                            window.chartjsNftUnlockedValue.data.labels = chartNftUnlockedValueLabels;
                            window.chartjsNftUnlockedValue.data.datasets.forEach((dataset) => {
                                dataset.data = chartNftUnlockedValueData
                            });
                            window.chartjsNftUnlockedValue.update()

                            let chartUnlockedNftDistributionLabels = []
                            let chartUnlockedNftDistributionData = []
                            for(let i = 111; i<= 150; i++) {
                                chartUnlockedNftDistributionLabels.push(i+"%")
                                let sumAmt = 0
                                nftList.map(n =>  sumAmt += (n.unlockDate < timestampNow*1000 && n.efficiency <= (i*0.01)) ? n.amount : 0)
                                chartUnlockedNftDistributionData.push(sumAmt)
                            }
                            

                            if(!window.chartjsUnlockedNftDistribution) {
                                window.chartjsUnlockedNftDistribution = new Chart(document.getElementById('chartUnlockedNftDistribution').getContext('2d'), {
                                    type: 'line',
                                    data: {
                                        labels: [],
                                        datasets: [{
                                            label: 'Total Unlocked Value @ efficiency',
                                            data: [],
                                            borderColor: ['rgba(255, 255, 255, 1)'],
                                            backgroundColor:  ['rgba(255, 255, 255, 0.5)'],
                                        }]
                                    },
                                    options: {
                                        scales: {
                                            y: {
                                                beginAtZero: false
                                            }
                                        }
                                    }
                                });
                            }
                            window.chartjsUnlockedNftDistribution.data.labels = chartUnlockedNftDistributionLabels;
                            window.chartjsUnlockedNftDistribution.data.datasets.forEach((dataset) => {
                                dataset.data = chartUnlockedNftDistributionData
                            });
                            window.chartjsUnlockedNftDistribution.update()
                            

                            app.updateEthConnectRequiredUIs()
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
                        "render" : v => v ? "Unlocked" : "Locking"
                    },
                    {
                        "targets": "actionsCol",
                        "data": null,
                        "render" : (v, t, d) => {
                            let html = ''
                            if(app.#isOwningCurrentAddress()) {
                                if(v.isStaked) {
                                    html += `<button type='button' class='btn btn-secondary' onclick='app.unstakeNFT(${d.tokenId})'>Unstake</button>`
                                } else {
                                    html += `<button type='button' class='btn btn-primary' onclick='app.stakeNFT(${d.tokenId})'>Stake</button>`
                                    if(v.isUnlocked) {
                                        html += `<button type='button' class='btn btn-warning' onclick='app.decomposeNFT(${d.tokenId})'>Decompose</button>`
                                    }
                                    html += `<button type='button' class='btn btn-danger' onclick='app.transferNFT(${d.tokenId})'>Transfer</button>`
                                }
                            }
                            return html
                        }
                    }
                ],
                "order": [[ 0, "desc" ]],
                "pageLength": 25
            })
        // }

        this.startUpdatePriceLoop()
    }

    #isOwningCurrentAddress() {
        return !!this.addressInfo && !!this.posi.userAddress && this.addressInfo.address.toLowerCase() == this.posi.userAddress.toLowerCase()
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
                this.nftDataTable.page( 'first' ).draw( 'page' );
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
            let result = await AppUtils.showConfirm(`Harvest BUSD Farm?`, `referrer: ${this.localReferrer}`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestBusdFarm(this.localReferrer)
                    AppUtils.showSuccessToast(`BUSD Farm harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }

    async harvestPbond001Pool() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.pbond001Pool.userInfo.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest PBond-001 Pool?`, `referrer: ${this.localReferrer}`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestPbond001Pool(this.localReferrer)
                    AppUtils.showSuccessToast(`PBond-001 Pool harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }

    async harvestPbond002Pool() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.pbond002Pool.userInfo.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest PBond-002 Pool?`, `referrer: ${this.localReferrer}`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestPbond002Pool(this.localReferrer)
                    AppUtils.showSuccessToast(`PBond-002 Pool harvested`)
                } catch (ex) {
                    AppUtils.showErrorToast(ex.message)
                }
                this.reload(false)
            }
        }
    }

    async harvestPbond003Pool() {
        let remainSecond = Utils.getRemainingSeconds(Utils.timestampToDate(this.addressInfo.pbond003Pool.userInfo.nextHarvestUntil))
        if(remainSecond) {
            AppUtils.showError(`Next Harvest availabe after ${Utils.secondsToReadableTime(remainSecond)}`)
        } else {
            let result = await AppUtils.showConfirm(`Harvest PBond-003 Pool?`, `referrer: ${this.localReferrer}`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestPbond003Pool(this.localReferrer)
                    AppUtils.showSuccessToast(`PBond-003 Pool harvested`)
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
            let result = await AppUtils.showConfirm(`Harvest BNB Farm?`, `referrer: ${this.localReferrer}`)
            if(result.isConfirmed) {
                try {
                    await this.posi.harvestBnbFarm(this.localReferrer)
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
        let { value:to } = await AppUtils.showPrompt(`Transfer #${tokenId} to address:`, '', {
            inputValidator: address => {
                if(!this.posi.web3.utils.isAddress(address)) {
                    return "Invalid address"
                }
            }
        })
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
        if(!this.nftDataTable) {
            return
        }
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

    get localReferrer() {
        return localStorage.getItem("referrer")
    }

    updateLocalReferrer(address = null) {
        if(address) {
            if(this.posi.web3.utils.isAddress(address)) {
                localStorage.setItem("referrer", address)
            } else {
                throw "Invalid address: " + address
            }
        }
        $("#txtCurrentReferrer").text(this.localReferrer ? Utils.maskAddress(this.localReferrer) : "?")
    }

    async showSetReferrerDialog() {
        let { value:referrer } = await AppUtils.showPrompt("Enter referer address:", '', {
            inputValidator: address => {
                if(!this.posi.web3.utils.isAddress(address)) {
                    return "Invalid address"
                }
            }
        })
        if(referrer) {
            if(this.posi.web3.utils.isAddress(referrer)) {
                this.updateLocalReferrer(referrer)
                AppUtils.showSuccessToast(`Set referrer to ${referrer}`)
            } else {
                AppUtils.showError(`${referrer} is not a valid address`)
            }
        }
    }
}

