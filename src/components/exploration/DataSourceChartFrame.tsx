import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../style/Colors';
import { Sizes } from '../../style/Sizes';
import { DataSourceIcon } from '../common/DataSourceIcon';
import { DataSourceType, MeasureUnitType } from '../../measure/DataSourceSpec';
import { dataSourceManager } from '../../system/DataSourceManager';
import { OverviewSourceRow, StatisticsType, WeightRangedData } from '../../core/exploration/data/types';
import commaNumber from 'comma-number';
import { DateTimeHelper } from '../../time';
import { startOfDay, addSeconds, format } from 'date-fns';
import { SizeWatcher } from '../visualization/SizeWatcher';
import { DailyBarChart } from './visualization/browse/DailyBarChart';
import { scaleLinear } from 'd3-scale';
import { DailyHeartRateChart } from './visualization/browse/DailyHeartRateChart';
import { DailySleepRangeChart } from './visualization/browse/DailySleepRangeChart';
import { DailyWeightChart } from './visualization/browse/DailyWeightChart';


const lightTextColor = "#8b8b8b"

const headerHeight = 60

const containerStyle = {
    backgroundColor: 'white',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowColor: 'black',
    shadowOpacity: 0.07
}

const styles = StyleSheet.create({
    containerStyle: containerStyle,
    containerStyleFlat: {
        ...containerStyle,
        shadowOffset: null,
        shadowColor: null,
        shadowRadius: null,
        shadowOpacity: null,
        borderBottomColor: 'gray',
        borderBottomWidth: 1,
        paddingBottom: 6,
        paddingTop: 16
    },

    headerStyle: {
        height: headerHeight,
        flexDirection: "row",
        alignItems: 'center',
    },

    headerTitleStyle: {
        fontWeight: 'bold',
        color: Colors.textColorLight,
        fontSize: Sizes.normalFontSize,
        flex: 1
    },

    headerClickRegionWrapperStyle: { flex: 1, marginRight: 15 },

    headerClickRegionStyle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: headerHeight },

    headerDescriptionTextStyle: {
        fontWeight: '500',
        color: lightTextColor,
        fontSize: 14
    },

    todayButtonStyle: {
        height: headerHeight * 0.7, justifyContent: 'center',
        paddingRight: Sizes.horizontalPadding, paddingLeft: Sizes.horizontalPadding
    },

    todayUnitStyle: {
        fontWeight: '300',
        color: '#9B9B9B'
    },

    todayValueStyle: {
        color: Colors.today,
        fontWeight: 'bold'
    },

    iconContainerStyle: {
        paddingLeft: Sizes.horizontalPadding,
        paddingRight: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },

    chartAreaStyle: {
        padding: 0,
    },

    footerStyle: {
        padding: Sizes.horizontalPadding,
        flexDirection: 'row',
        justifyContent: 'space-around'
    },

    statValueStyle: {
        fontSize: 14,
        fontWeight: '500',
        color: lightTextColor
    },

    statLabelStyle: {
        fontSize: Sizes.tinyFontSize,
        color: '#Bababa',
        fontWeight: 'normal'
    }
})

export interface TodayInfo {
    label: string;
    formatted: Array<{ text: string; type: 'unit' | 'value' }>;
}

function formatTodayValue(data: OverviewSourceRow, unitType: MeasureUnitType): TodayInfo {
    const info = {

    } as TodayInfo

    switch (data.source) {
        case DataSourceType.Weight:
            info.label = "Recently"
            break;
        case DataSourceType.SleepRange:
        case DataSourceType.HoursSlept:
            info.label = "Last night"
            break;
        default: info.label = "Today"
            break;
    }

    switch (data.source) {
        case DataSourceType.StepCount:
            info.formatted = data.today != null ? [
                {
                    text: commaNumber(data.today),
                    type: 'value',
                },
                { text: ' steps', type: 'unit' },
            ] : null
            break;
        case DataSourceType.HeartRate:
            info.formatted = data.today != null ? [
                {
                    text: data.today.toString(),
                    type: 'value',
                },
                {
                    text: ' bpm',
                    type: 'unit',
                },
            ] : null
            break;
        case DataSourceType.Weight:
            if (data.today) {
                switch (unitType) {
                    case MeasureUnitType.Metric:
                        info.formatted = [{ type: 'value', text: data.today.toFixed(1) }, { type: 'unit', text: ' kg' }]
                        break;
                    case MeasureUnitType.US:
                        const convert = require('convert-units')
                        info.formatted = [{ type: 'value', text: convert(data.today).from('kg').to('lb').toFixed(1) }, { type: 'unit', text: ' lb' }]
                        break;
                }
            } else {
                info.formatted = null
            }
            break;
        case DataSourceType.HoursSlept:
            if (data.today) {
                var roundedSecs = data.today
                info.formatted = []
                if (data.today % 60 >= 30) {
                    roundedSecs = data.today - (data.today % 60) + 60
                }
                const hours = Math.floor(roundedSecs / 3600)
                const minutes = Math.floor((roundedSecs % 3600) / 60)
                if (hours > 0) {
                    info.formatted.push({ type: 'value', text: hours + " " })
                    info.formatted.push({ type: 'unit', text: "hr" + (minutes > 0 ? " " : "") })
                }

                if (hours > 0 && minutes > 0 || hours === 0) {
                    info.formatted.push({ type: 'value', text: minutes + " " })
                    info.formatted.push({ type: 'unit', text: 'min' })
                }
            } else {
                info.formatted = null
            }
            break;
        case DataSourceType.SleepRange:
            if (data.today) {
                const pivot = startOfDay(new Date())
                const actualBedTime = addSeconds(pivot, Math.round(data.today[0]))
                const actualWakeTime = addSeconds(pivot, Math.round(data.today[1]))

                info.formatted = [
                    { type: 'value', text: format(actualBedTime, 'hh:mm ') },
                    { type: 'unit', text: format(actualBedTime, 'a').toLowerCase() },
                    { type: 'unit', text: ' - ' },
                    { type: 'value', text: format(actualWakeTime, 'hh:mm ') },
                    { type: 'unit', text: format(actualWakeTime, 'a').toLowerCase() },
                ]
            } else {
                info.formatted = null
            }
            break;
    }

    return info
}

function getStatisticsLabel(type: StatisticsType): string {
    switch (type) {
        case 'avg': return "Avg."
        case 'range': return 'Range'
        case 'total': return 'Total'
        case 'bedtime': return 'Avg. Bedtime'
        case 'waketime': return 'Avg. Wake Time'

    }
}

function formatStatistics(sourceType: DataSourceType, statisticsType: StatisticsType, measureUnitType: MeasureUnitType, value: any): string {
    switch (sourceType) {
        case DataSourceType.StepCount:
            switch (statisticsType) {
                case "avg": return commaNumber(Math.round(value));
                case "range": return commaNumber(value[0]) + " - " + commaNumber(value[1])
                case "total": return commaNumber(value)
            }
        case DataSourceType.HeartRate:
            switch (statisticsType) {
                case 'avg': return Math.round(value).toString()
                case 'range': return value[0] + " - " + value[1]
            }
        case DataSourceType.Weight:
            switch (measureUnitType) {
                case MeasureUnitType.Metric:
                    break;
                case MeasureUnitType.US:
                    const convert = require('convert-units')
                    if (statisticsType == 'range') {
                        value = [convert(value[0]).from('kg').to('lb'), convert(value[1]).from('kg').to('lb')]
                    } else {
                        value = convert(value).from('kg').to('lb')
                    }
                    break;
            }
            switch (statisticsType) {
                case 'avg': return value.toFixed(1)
                case 'range': return value[0].toFixed(1) + " - " + value[1].toFixed(1)
            }

        case DataSourceType.HoursSlept:
            switch (statisticsType) {
                case 'avg': return DateTimeHelper.formatDuration(Math.round(value), true)
                case 'range': return DateTimeHelper.formatDuration(value[0], true) + " - " + DateTimeHelper.formatDuration(value[1], true)
            }

        case DataSourceType.SleepRange:
            const pivot = startOfDay(new Date())
            const actualTime = addSeconds(pivot, Math.round(value))
            return format(actualTime, 'hh:mm a').toLowerCase()
    }
}

function getChartView(sourceType: DataSourceType, data: OverviewSourceRow, width: number, height: number, measureUnitType: MeasureUnitType): any {
    switch (sourceType) {
        case DataSourceType.StepCount:
            return <DailyBarChart
                dataSource={DataSourceType.StepCount}
                preferredValueRange={data.preferredValueRange}
                dateRange={data.range} data={data.data} containerHeight={height} containerWidth={width}
                valueTickFormat={(tick: number) => { return (tick % 1000 === 0 && tick != 0) ? tick / 1000 + "k" : commaNumber(tick) }} />
        case DataSourceType.HoursSlept:
            return <DailyBarChart dateRange={data.range}

                dataSource={DataSourceType.HoursSlept}
                preferredValueRange={data.preferredValueRange}
                data={data.data.map(d => ({ numberedDate: d.numberedDate, value: d.lengthInSeconds }))}
                containerHeight={height} containerWidth={width}
                valueTickFormat={(tick: number) => { return DateTimeHelper.formatDuration(tick, true) }}
                valueTicksOverride={(maxValue: number) => {
                    const scale = scaleLinear().domain([0, Math.ceil(maxValue / 3600)]).nice()
                    return {
                        ticks: scale.ticks(5).map(t => t * 3600),
                        newDomain: scale.domain().map(t => t * 3600)
                    }
                }}
            />
        case DataSourceType.HeartRate:
            return <DailyHeartRateChart

                dataSource={DataSourceType.HeartRate}
                preferredValueRange={data.preferredValueRange}
                dateRange={data.range} data={data.data} containerWidth={width} containerHeight={height}
            />
        case DataSourceType.SleepRange:
            return <DailySleepRangeChart
                dataSource={DataSourceType.SleepRange}
                preferredValueRange={data.preferredValueRange}
                dateRange={data.range} data={data.data}
                containerHeight={height} containerWidth={width}
            />
        case DataSourceType.Weight:
            const weightData = data as WeightRangedData
            return <DailyWeightChart dateRange={data.range} data={data.data}
                preferredValueRange={data.preferredValueRange}
                pastNearestLog={weightData.pastNearestLog}
                futureNearestLog={weightData.futureNearestLog}
                containerWidth={width} containerHeight={height}
                measureUnitType={measureUnitType}
            />
    }
}

export const DataSourceChartFrame = (props: {
    data: OverviewSourceRow
    measureUnitType: MeasureUnitType
    showToday?: boolean
    flat?: boolean
    showHeader?: boolean
    onHeaderPressed?: () => void
    onTodayPressed?: () => void
}) => {

    const [chartContainerWidth, setChartContainerWidth] = useState(-1)
    const [chartContainerHeight, setChartContainerHeight] = useState(-1)

    const spec = dataSourceManager.getSpec(props.data.source)
    const todayInfo = formatTodayValue(props.data, props.measureUnitType)

    return <View style={props.flat === true ? styles.containerStyleFlat : styles.containerStyle}>
        {props.showHeader !== false && <View style={styles.headerStyle}>
            <View style={styles.headerClickRegionWrapperStyle}>
                <TouchableOpacity onPress={props.onHeaderPressed} disabled={props.onHeaderPressed == null} activeOpacity={0.7} style={styles.headerClickRegionStyle}>
                    <View style={styles.iconContainerStyle}>
                        <DataSourceIcon size={18} type={props.data.source} color={Colors.accent} />
                    </View>
                    <Text style={styles.headerTitleStyle}>{spec.name}</Text>
                </TouchableOpacity>
            </View>

            {
                props.showToday !== false && props.data.today != null ?
                    <TouchableOpacity style={styles.todayButtonStyle}
                        onPress={props.onTodayPressed} disabled={props.onTodayPressed == null}><Text style={styles.headerDescriptionTextStyle}>
                            <Text>{todayInfo.label + ": "}</Text>
                            {
                                todayInfo.formatted != null ? todayInfo.formatted.map((chunk, index) =>
                                    <Text key={index} style={chunk.type === 'unit' ? styles.todayUnitStyle : styles.todayValueStyle}>{chunk.text}</Text>)
                                    :
                                    (<Text style={styles.todayValueStyle}>no value</Text>)
                            }
                        </Text></TouchableOpacity> : <></>
            }
        </View>}
        <View style={styles.chartAreaStyle}>
            <SizeWatcher containerStyle={{ aspectRatio: 3 }} onSizeChange={(width, height) => { setChartContainerWidth(width); setChartContainerHeight(height) }}>
                {
                    getChartView(spec.type, props.data, chartContainerWidth, chartContainerHeight, props.measureUnitType)
                }
            </SizeWatcher>
        </View>

        <View style={styles.footerStyle}>{
            props.data.statistics && props.data.statistics.map(stat => {
                return <Text key={stat.type} style={styles.statValueStyle}>
                    <Text style={styles.statLabelStyle}>{getStatisticsLabel(stat.type) + " "}</Text>
                    <Text>{stat.value != null && (typeof stat.value == "number" || (stat.value[0] != null && stat.value[1] != null)) ? formatStatistics(props.data.source, stat.type, props.measureUnitType, stat.value) : "no value"}</Text>
                </Text>
            })
        }
        </View>
    </View >
}