import fs from 'node:fs/promises'
import path from 'node:path'

import { stepsLogger } from '@/config/stepsLogger'
import { checkPathAccessibility } from '@/utils'

type Video = {
  title: string
  filename: string
  description: string
  webpage_url: string
  availability: string
  upload_date: string
  requested_downloads: Array<{ filename: string }>
}

type Category = {
  entries: Array<Video>
}

type YtdlpJson = {
  entries: Array<Category>
}

const stringToDate = (stringDate: string): Date =>
  new Date(
    Number(stringDate.slice(0, 4)),
    Number(stringDate.slice(4, 6)) - 1,
    Number(stringDate.slice(6, 8))
  )

const main = async () => {
  const ytdlpJsonPath = process.argv[2]
  if (!ytdlpJsonPath) {
    throw new Error('Missing original json file')
  }

  if (!ytdlpJsonPath.endsWith('.json')) {
    throw new Error('Path is not a .json file')
  }

  const pathAccessibility = await checkPathAccessibility(ytdlpJsonPath, fs.constants.R_OK)
  if (pathAccessibility !== 'OK') {
    throw new Error(`File doesn't exist or cannot be read`)
  }

  const ytdlpStringJson = await fs.readFile(ytdlpJsonPath)
  const ytdlpJson = JSON.parse(ytdlpStringJson.toString()) as YtdlpJson

  const videos = ytdlpJson.entries
    .map(category => category.entries)
    .reduce((allVideos, categoryVideos) => {
      allVideos.push(...categoryVideos)

      return allVideos
    }, [])
    .map((video, index) => {
      const { title, description, webpage_url, availability, upload_date, requested_downloads } =
        video

      const [requested_download] = requested_downloads
      if (!requested_download) {
        throw new Error(`Expected to have at least one requested_download at video index ${index}`)
      }

      const { filename } = requested_download

      const videoMapped: Omit<Video, 'requested_downloads'> = {
        title,
        filename,
        description,
        webpage_url,
        availability,
        upload_date: stringToDate(upload_date).toISOString().split('T')[0] || ''
      }

      return videoMapped
    })

  const ytdlpJsonPathParsed = path.parse(ytdlpJsonPath)

  const videosOutputPath = path.join(ytdlpJsonPathParsed.dir, `videos.json`)

  await fs.writeFile(videosOutputPath, JSON.stringify(videos, null, 2))

  stepsLogger.info(`Successfully generated videos json file at "${videosOutputPath}"`)
}

main()
