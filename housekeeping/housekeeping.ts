import { Persistence } from "https://deno.land/x/persistence@1.1.0/persistence.ts"
import * as log from "https://deno.land/std/log/mod.ts";
import { Utilities } from "../utilities.ts";
import { walk, walkSync } from "https://deno.land/std/fs/mod.ts";
import { move } from "https://deno.land/std/fs/mod.ts";

// import { CityLocationService } from "https://deno.land/x/location@1.1.1/citylocationservice.ts"

export class Housekeeping {

    private static fileIdTelegramGroups = `${Deno.cwd()}/groups/telegram.json`
    private static fileIdEvents = `${Deno.cwd()}/events/events.json`
    private static fileIdTelegramEvents = `${Deno.cwd()}/events/telegram-events.json`
    private static fileIdArchivedEvents = `${Deno.cwd()}/events/events-archive.json`
    private static fileIdReportedEvents = `${Deno.cwd()}/events/events-block-list.json`
    private static fileIdReports = `${Deno.cwd()}/events/reports.json`


    public static async correctEventLists() {

        const telegramEvents = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdTelegramEvents))
        let events = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdEvents))
        const telegramGroups = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdTelegramGroups))

        log.info(`number of events before: ${events.length}`)


        events = Housekeeping.addTelegramEvents(events, telegramEvents)
        events = await Housekeeping.enrichChatLink(events, telegramGroups)

        await Housekeeping.archiveInvalidImages()
        await Housekeeping.archiveImagesWithPastDate()

        const validDates = Housekeeping.getValidDates()

        let correctedEvents: any = []

        const reports = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdReports))
        log.warning(`number of unique reports: ${reports.length}`)

        let alreadyThere: string[] = []

        for (const event of events) {
            let avoidingDuplicateFor = `${event.title}-${event.startDate}-${event.city}-${event.countryCode}-${event.dances}`
            if (alreadyThere.includes(avoidingDuplicateFor)) {
                log.warning(`this could have been a duplicate entry: ${avoidingDuplicateFor}`)
            } else {
                alreadyThere.push(avoidingDuplicateFor)
                if (reports.includes(event.id)) {
                    let reportedEvents = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdReportedEvents))
                    log.warning(`number of reportedEvents before: ${reportedEvents.length}`)
                    reportedEvents.push(event)
                    await Persistence.saveToLocalFile(Housekeeping.fileIdReportedEvents, JSON.stringify(reportedEvents))
                    log.info(`number of reported events after: ${reportedEvents.length}`)
                } else if (validDates.includes(event.startDate)) {
                    // space for potential corrections

                    correctedEvents.push(event)
                } else {
                    const archivedEvents = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdArchivedEvents))
                    log.info(`number of archived events before: ${archivedEvents.length}`)
                    archivedEvents.push(event)
                    log.warning(`archiving event with startDate: ${event.startDate}`)
                    await Persistence.saveToLocalFile(Housekeeping.fileIdArchivedEvents, JSON.stringify(archivedEvents))
                    log.info(`number of archived events after: ${archivedEvents.length}`)
                }
            }
        }

        log.info(`number of events after: ${correctedEvents.length}`)
        await Persistence.saveToLocalFile(Housekeeping.fileIdEvents, JSON.stringify(correctedEvents))
    }

    private static async archiveImagesWithPastDate() {
        const validDates = Housekeeping.getValidDates()
        for (const entry of walkSync(`${Deno.cwd()}/events`)) {
            if (entry.path.includes("dance/events/dancing-")) {
                const dateFromImageName = entry.path.split('-on-')[1].substr(0, 10)
                if (dateFromImageName.length === 10 && dateFromImageName.substr(0, 4) === (new Date().getFullYear().toString()) && !validDates.includes(dateFromImageName)) {
                    log.info(dateFromImageName)
                    await move(entry.path, `${Deno.cwd()}/events/archived-images/${entry.path.split('dance/events/')[1]}`); 
                }
            }
        }
    }

    private static async archiveInvalidImages() {
        for (const entry of walkSync(`${Deno.cwd()}/events`)) {
            if (entry.path.includes(`dance/events/dancing-"`)) {
                if (entry.path.includes("undefined")) {
                    log.warning(`${entry.path} shall be archived`);
                    // console.log(`"${entry.path.substr(entry.path.length - 17, 13)}",`)

                    await Housekeeping.archiveImage(entry.path)
                }
            }
        }
    }

    private static async archiveImage(imageId: string) {
        await move(imageId, `${Deno.cwd()}/events/archived-images/${imageId.split('dance/events/')[1]}`);
    }



    private static async enrichChatLink(events: any[], telegramGroups: any[]): Promise<any[]> {
        for (const e of events) {
            if (e.chatLink === undefined || e.chatLink === '') {
                e.chatLink = `https://t.me/joinchat/${Utilities.getClosestEntry(telegramGroups, e.lat, e.lon).telegramInvitationLink}`
            }
        }

        return events
    }

    private static addTelegramEvents(events: any[], telegramEvents: any[]) {
        log.info(`checking ${telegramEvents.length} telegram events`)
        log.info(`checking ${events.length} events`)

        let enhancedEventList = events

        for (const telegramEvent of telegramEvents) {
            const existingEntry = events.filter((e: any) => e.id === telegramEvent.id)[0]
            if (existingEntry === undefined) {
                enhancedEventList.push(telegramEvent)
            }
        }

        log.info(`returning ${events.length} events after having added telegram events`)

        return enhancedEventList
    }


    private static getValidDates(): string[] {
        let yesterday = new Date();
        yesterday.setDate(new Date().getDate() - 1);
        const yesterdayString = Utilities.getIt(yesterday)

        return [yesterdayString].concat(Utilities.getNextXDates(100000))
    }

    // private static async  correctTelegramGroups() {

    //     const telegramGroups = JSON.parse(await Persistence.readFromLocalFile(Housekeeping.fileIdTelegramGroups))
    //     console.log(telegramGroups.length)

    //     let correctedGroups: any = []
    //     for (const group of telegramGroups) {
    //         // space for potential corrections

    //         correctedGroups.push(group)
    //     }

    //     await Persistence.saveToLocalFile(Housekeeping.fileIdTelegramGroups, JSON.stringify(correctedGroups))
    // }


    // public static async ensureLatLonCorrect(events: any[]): Promise<any[]> {

    //     for (const event of events){
    //         if (event.lat === 0){
    //             log.error(`latitude seems wrong`)
    //             const cityLocation = await CityLocationService.getCityLocation(event.countryCode, event.city)
    //             log.warning(cityLocation)
    //             event.lat = cityLocation.latitude
    //             event.lon = cityLocation.longitude
    //         }
    //     }

    //     return events
    // }

}

