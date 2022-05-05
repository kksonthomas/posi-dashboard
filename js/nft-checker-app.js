import {Posi, PosiNFT} from './posi.js'
import Utils from './utils.js'
import AppUtils from './app-utils.js'
 

export default class App {
    constructor() {
        this.posi = new Posi();
        // this.posi = new Posi('https://bsc-dataseed1.ninicoin.io:443/');
        this.priceInfo = {};
        this.nftDataTable;
    }

    #retrieveTokenIdQueryString(latestId) {
        let params = window.location.search.slice(1).split("&").map(x => x.split("="))
        let a = params.find(x => x[0].toLowerCase() == 'a')
        let b = params.find(x => x[0].toLowerCase() == 'b')
        let tokenA = a && a[1] ? a[1] : null;
        let tokenB = b && b[1] ? b[1] : null;

        let result = {default: false}
        
        if(tokenA && tokenB && tokenA != tokenB) {
            result.a = Math.min(tokenA, tokenB)
            result.b = Math.max(tokenA, tokenB)
        } else if(tokenA){
            result.a = result.b = tokenA
        } else if(tokenB){
            result.a = result.b = tokenB
        } else {
            result.a = latestId-100
            result.b = latestId
            result.default = true          
        }
        return result
    }

    async start() {
        let app = this

        app.posi.contracts.nftFactoryContract.methods._gegoId().call().then(latestId => {
            $("#txtLatestTokenId").text(`#${latestId}`)

            let tokensToQuery = this.#retrieveTokenIdQueryString(latestId)

            if(!tokensToQuery.default) {
                $("#txtTokenStart").val(tokensToQuery.a);
            }
            if(tokensToQuery.a == tokensToQuery.b) {
                $("#txtTargetToken").text(`#${tokensToQuery.a}`)
            } else {
                if(!tokensToQuery.default) {
                    $("#txtTokenEnd").val(tokensToQuery.b);
                }
                $("#txtTargetToken").text(`#${tokensToQuery.a} - #${tokensToQuery.b}`)
            }

            

            $('#posiNFT-table thead tr').clone(true).addClass('filters').appendTo('#posiNFT-table thead');

            app.nftDataTable = $("#posiNFT-table").DataTable({
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
                ajax: (d, callback, settings) => {
                    let tokensToQuery = this.#retrieveTokenIdQueryString(latestId)

                    let tokenIdList = []
                    for(let i=tokensToQuery.a; i<=tokensToQuery.b; i++) {
                        tokenIdList.push(i)
                    }

                    app.posi.multicall.call(tokenIdList.map(tokenId => { return {
                            tokenId: tokenId,
                            data: app.posi.contracts.nftFactoryContract.methods._gegoes(tokenId)
                        }
                    })).then(data => {
                        app.posi.multicall.call(data.map(x => { 
                            x.data.quality = app.posi.contracts.nftStakingContract.methods.correctQuality(x.data.grade, x.data.quality)
                            return x
                        })).then(data => {
                            let nftList = data.map(d => new PosiNFT(app.posi, d.tokenId, false, d.data, []))
                            nftList.filter(nft => nft.grade > 0)
                            callback({data: nftList})
                            this.updatePriceInfo()        
            
                            // //charts
                            // let timestampNow = Date.now() / 1000
                            // let todayString = Utils.datetimeToDate(new Date())
                            // let maxUnlockTimestamp = Math.max(...nftList.map(n => n.unlockDate)) / 1000
                            // let maxUnlockDate = Utils.dateAddDay(new Date(maxUnlockTimestamp * 1000), 1)
                            // let maxUnlockDateString = Utils.datetimeToDate(maxUnlockDate)
                            // let currentDateString = todayString;
                            // let currentDate = new Date()
                            // let chartNftUnlockedValueLabels = []
                            // let chartNftUnlockedValueData = []
                            // if(timestampNow < maxUnlockTimestamp) {
                            //     while(currentDateString != maxUnlockDateString) {
                            //         currentDateString = Utils.datetimeToDate(currentDate)
                            //         chartNftUnlockedValueLabels.push(currentDateString)
                            //         let sumAmt = 0
                            //         nftList.map(n =>  sumAmt += n.unlockDate < currentDate.getTime() ? n.amount : 0)
                            //         chartNftUnlockedValueData.push(sumAmt)
                            //         currentDate.setDate(currentDate.getDate()+1)
                            //     }
                            // } else {
                            //     chartNftUnlockedValueLabels.push(todayString)
                            //     let sumAmt = 0
                            //     nftList.map(n => sumAmt += n.amount)
                            //     chartNftUnlockedValueData.push(sumAmt)
                            // }
            
                            // if(!window.chartjsNftUnlockedValue) {
                            //     window.chartjsNftUnlockedValue = new Chart(document.getElementById('chartNftUnlockedValue').getContext('2d'), {
                            //         type: 'line',
                            //         data: {
                            //             labels: [],
                            //             datasets: [{
                            //                 label: 'Total Unlocked Value @ date',
                            //                 data: [],
                            //                 borderColor: ['rgba(255, 255, 255, 1)'],
                            //                 backgroundColor:  ['rgba(255, 255, 255, 0.5)'],
                            //             }]
                            //         },
                            //         options: {
                            //             scales: {
                            //                 y: {
                            //                     beginAtZero: false
                            //                 }
                            //             }
                            //         }
                            //     });
                            // }
                            // window.chartjsNftUnlockedValue.data.labels = chartNftUnlockedValueLabels;
                            // window.chartjsNftUnlockedValue.data.datasets.forEach((dataset) => {
                            //     dataset.data = chartNftUnlockedValueData
                            // });
                            // window.chartjsNftUnlockedValue.update()

                            //charts
                            let chartNftDistrubutionLabels = []
                            let chartNftDistrubutionData = []
                            for(let grade=1; grade<=6; grade++) {
                                chartNftDistrubutionLabels.push(`Grade ${grade}`)
                                chartNftDistrubutionData.push(nftList.filter(x => x.grade == grade).length)
                            }
                                        
                            if(!window.chartjsNftDistribution) {
                                window.chartjsNftDistribution = new Chart(document.getElementById('chartNftDistribution').getContext('2d'), {
                                    type: 'doughnut',
                                    data: {
                                        labels: [],
                                        datasets: [{
                                            label: 'NFT distubution',
                                            data: [],
                                            borderColor: ['rgba(255, 255, 255, 1)'],
                                            backgroundColor:  [
                                                '#d28a1b',
                                                '#b9d6da',
                                                '#38c52a',
                                                '#c06ed5',
                                                '#0385c5',
                                                '#f3d907'
                                            ],
                                        }]
                                    }
                                });
                            }
                            window.chartjsNftDistribution.data.labels = chartNftDistrubutionLabels;
                            window.chartjsNftDistribution.data.datasets.forEach((dataset) => {
                                dataset.data = chartNftDistrubutionData
                            });
                            window.chartjsNftDistribution.update()
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
                        "targets": "isDecomposedCol",
                        "data": "isDecomposed",
                        "render" : v => v ? "Decomposed" : "Active"
                    },
                    {
                        "targets": "createdDateCol",
                        "data": "createdDate",
                        "render" : v => {
                            if(v) {
                                return moment(v).format("YYYY-MM-DD HH:mm:ss")
                            }
                        }
                    },
                    {
                        "targets": "actionsCol",
                        "data": null,
                        "render" : (v, t, d) => {
                            let html = ''
                            html += `<a href="https://bscscan.com/token/0xeca16df8d11d3a160ff7a835a8dd91e0ae296489?a=${d.tokenId}" class='btn btn-info' target="_blank">BscScan <i class='fa fa-external-link-alt'></i></a>`
                            return html
                        }
                    },
                    {
                        "targets": "metaDataCol",
                        "data": null,
                        "render" : (v, t, d) => {
                            let html = ''
                            html += `${d.tLevel}/${d.ruleId}/${d.nftType}`
                            return html
                        }
                    }
                ],
                "order": [[ 0, "desc" ]],
                "pageLength": 25
            })
        })

        this.startUpdatePriceLoop()
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
}

