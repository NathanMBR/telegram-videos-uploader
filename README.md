🇧🇷 Você está lendo a versão em inglês. [Clique aqui para ler a versão em português.](./README_pt-BR.md)

# telegram-videos-uploader
Telegram videos uploader made with Node.js and TypeScript.

## Images

![CLI usage - Example 1](.github/images/cli_example_1.png)
![CLI usage - Example 2](.github/images/cli_example_2.png)
![CLI usage - Example 3](.github/images/cli_example_3.png)

## Table of Contents
- [About the project](#about-the-project)
- [Setup and Installation -> Minimum requirements](#minimum-requirements)
- [Setup and Installation -> Installation](#installation)
- [Setup and Installation -> Understanding the difference between `Bot API` servers](#understanding-the-difference-between-bot-api-servers)
- [Setup and Installation -> Environment variables](#environment-variables)
- [Setup and Installation -> Creating the `presets.json` file](#creating-the-presetsjson-file)
- [Setup and Installation -> Spinning up the local `Bot API` server](#spinning-up-the-local-bot-api-server)
- [Usage -> Running the project](#running-the-project)
- [Usage -> How it works](#how-it-works)
- [Usage -> About the `videos.json` file](#about-the-videosjson-file)
- [Usage -> Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## About the project
This project is capable of uploading videos to Telegram through the `Bot API`, using a bot previously added to the channel where you want to upload the videos. It was developed by Nathan Murillo, whose GitHub profile can be found [by clicking here](https://github.com/NathanMBR).

## Setup and Installation
### Minimum requirements
- Node.js 24 or higher
- pnpm 9 or higher
- ffmpeg CLI
- ffprobe CLI
- bash and jq CLIs (only required to use the `videos.json` conversion script; see [this section](#about-the-videosjson-file))
- A Telegram bot token + the ID of the channel where the videos will be posted (the bot must have permission to send messages)
- A `presets.json` configuration file (see [this section](#creating-the-presetsjson-file))

### Installation
```bash
git clone https://github.com/NathanMBR/telegram-videos-uploader.git
cd telegram-videos-uploader
pnpm install
```

### Understanding the difference between `Bot API` servers
Telegram provides two ways of using the `Bot API`:

1. Through the official server (available via the `https://api.telegram.org` link);
2. Through a self-hosted local server.

The official server does not require certain configurations that would be necessary for the local one, but in return it has low upload limits (around 50 MB for videos). A local server has much higher limits (2000 MB), but it requires registering an application on Telegram and obtaining an API ID and hash. Fortunately, this repository includes a [`compose.yml`](./compose.yml) file that can be used to quickly spin up a self-hosted server using Docker Compose, requiring only that you provide the necessary environment variables (see [the section below](#environment-variables)).

You can read more about the benefits of a self-hosted API server [by clicking this link](https://core.telegram.org/bots/api#using-a-local-bot-api-server), and understand how to register the application and obtain the necessary information [by clicking this other link](https://core.telegram.org/api/obtaining_api_id).

### Environment variables
You can copy the `.env.example` example file and replace its values with the ones you have:

```bash
cp .env.example .env
```

Table with the available environment variables:

| Variable | Required? | Description |
|---|---|---|
| `TELEGRAM_API_ID` | No | Telegram API ID* |
| `TELEGRAM_API_HASH` | No | Telegram API hash* |

> **\*Note:** Required if you are going to use the local `Bot API` server through Docker Compose.

> **Note:** The database location is **not** an environment variable: it is defined per preset through the `databaseUrl` property inside the `presets.json` file (see [this section](#creating-the-presetsjson-file)). If you do not intend to use the local `Bot API` server, the `.env` file is not needed at all.

### Creating the `presets.json` file
You can also copy the [`presets.example.json`](./presets.example.json) example file and replace its values with the ones you have:
```bash
cp presets.example.json presets.json
```

Example with comments:
```jsonc
[
  {
    "name": "My Preset", // Preset name, used in the preset selection
    "origin": "anything", // (Optional) Arbitrary identifier, useful when you have more than one preset and want to differentiate the data in the database
    // SQLite database URL used by this preset, in the "file:file-name.db" format
    // Relative paths are resolved from the directory where the command is run; you can also use an absolute path ("file:/path/to/database.db")
    // Each preset can point to its own database file, and the file (along with its tables) is created automatically if it doesn't exist yet
    "databaseUrl": "file:database.db",
    "telegram": {
      // Base API URL for uploading the videos
      // If needed, change it to the address of the local Bot API server running on Docker Compose
      "apiBaseUrl": "https://api.telegram.org",
      "botToken": "0000000000:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // Telegram BOT token
      "channelId": "-100XXXXXXXXXX" // ID of the channel where the videos will be posted
    },
    "videosDirectory": "/path/to/videos", // Directory where your videos are located
    "postDescription": {
      // (Optional) The base text that will be posted along with the video, which can be an array of strings (as below) or a single string
      // If it's an array, the strings are concatenated with a line break (\n)
      // The text supports MarkdownV2 (as can be seen in the line starting with "Title"), but using it is not required
      "baseText": [
        "Title: [#VIDEO_TITLE](#VIDEO_URL)", // This makes the #VIDEO_TITLE placeholder text clickable and links to the #VIDEO_URL placeholder
        "Description: #VIDEO_DESCRIPTION",
        "Channel: [#CHANNEL_TITLE](#CHANNEL_URL)", // The same from title applies here
        "Availability: #AVAILABILITY",
        "Published on: #DATE",
        "Part: #PART_CURRENT of #PART_TOTAL"
      ],

      "channel": {
        "name": "My Channel [Twitch]", // (Optional) Name of the channel the video came from, which will replace the #CHANNEL_TITLE placeholder
        "url": "https://www.twitch.tv/mychannel" // (Optional) Link of the channel the video came from, which will replace the #CHANNEL_URL placeholder
      },

      // (Optional) Date format for the #DATE placeholder
      // "DD" means "day", "MM" means "month" and "YYYY" means "year"
      // Check the "Preset.ts" file inside the "./src/domain" directory to see all available formats
      "dateFormat": "MM/DD/YYYY",

      // (Optional) Mapping of the possible availability states
      "availability": {
        "private": "Private",
        "premiumOnly": "Only for YouTube Premium users",
        "subscriberOnly": "Only for channel members / subs",
        "needsAuth": "Public (requires login)",
        "unlisted": "Unlisted",
        "public": "Public"
      }
    }
  }
]
```

The `presets.json` file is loaded automatically if it is in the project's root directory. If you want to save it under a different name or in a different directory, you can point to the file path with a flag when running the command. Check this option [in the section below](#running-the-project).

> **WARNING:** The `presets.json` must be saved without any comments.

### Spinning up the local `Bot API` server
After confirming that the environment variables are correctly set, just run the command below:
```bash
sudo docker compose up -d
```

## Usage
### Running the project
```bash
# Default usage: build + start
pnpm build
pnpm start

# For quick use
pnpm dev

# Pointing to a different presets.json file
pnpm start --presetsPath /new/path/to/presets.json
pnpm start -p /new/path/to/presets.json
```

### How it works
The code reads the contents of the `presets.json` file in the project's root directory to obtain its settings. From there, it first asks the user to select one of the presets provided by the file. Right after the selection, it connects to the database defined in the preset's `databaseUrl` property and applies the pending migrations automatically (creating the database file if it doesn't exist yet), and then asks the user to select an action.

The available actions are:

- **Upload videos:** reads the video data from the `videos.json` file inside the preset's videos directory (if it exists) to use as a reference. Then, the video is split into segments smaller than (or equal to) 1.75GB in size, the _cover image_ is converted into a _thumbnail_ if it already exists or extracted from the video itself otherwise, and the video is uploaded to the Telegram channel.

- **Check preset data:** doesn't upload anything. It prints the main settings of the chosen preset (name, origin, database, videos directory, channel name, channel URL and date format) and then queries the Telegram `Bot API` to print the data of the channel (title and description) and of the bot (name and username) that the preset actually points to. It's useful to confirm that the bot token, the channel ID and the API URL are correct before starting an upload.

### About the `videos.json` file
The `videos.json` file defines the video information that will be used to post it to the Telegram channel, such as title, URL, among others. It must always be saved with this name, in the same directory specified in the preset you are using. Its format is an array of objects containing the following properties:

| Property | Type | Description |
|---|---|---|
| `title` | Text | The video title |
| `filename` | Text | The video file name |
| `description` | Text | The video description |
| `webpage_url` | Text | The video URL |
| `availability` | Enum | The video availability; can be `public`, `private`, `unlisted`, `needs_auth`, `premium_only` or `subscriber_only`
| `upload_date` | Text | The video upload date, in the `YYYY-MM-DD` format

If you use the [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) tool to download videos from a YouTube channel, you can generate the `videos.json` file through it and [the `convertYtdlpJsonToVideosJson.sh` script](./scripts/convertYtdlpJsonToVideosJson.sh), located in the `scripts` directory. First, use the command below:
```bash
yt-dlp -J https://youtube.com/channel-link > ytdlp.json
```

> **Note:** If you need to download videos restricted to subscribers of a channel's membership system, check [this `yt-dlp` tutorial about exporting cookies](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies). For it to work, you will need at least one account that has the subscription.

After generating the temporary `ytdlp.json` file, use the conversion script mentioned above, inserting the temporary file's path in the appropriate place:
```bash
./scripts/convertYtdlpJsonToVideosJson.sh /path/to/ytdlp.json
```

The script is a bash script and depends on the [`jq`](https://jqlang.org) CLI being available on your `PATH`.

The generated file will be saved in the same folder where `ytdlp.json` is, named `videos_<timestamp>.json` (the timestamp avoids overwriting a previous conversion). The script prints its full path at the end. After that, you can delete the temporary file. Don't forget to rename the generated file to `videos.json` and, if necessary, to move it to the folder specified in the preset to be used within the `presets.json` file.

If you wish, it is also possible to write the `videos.json` file manually, although this is a laborious process.

> **Note:** the `videos.json` file is not required for the upload to work, but only the minimum necessary information will be provided. Most of the post description's _placeholders_ will be empty.

### Limitations
- If your videos are too large, it won't be possible to use Telegram's default API, and you'll need to spin up your own server for the upload. Check the ["Understanding the difference between `Bot API` servers"](#understanding-the-difference-between-bot-api-servers) section to learn more about it.

- At the present time, this project is only capable of handling videos in the `.mp4` format and _cover images_ in the `.jpg` and `.jpeg` formats. If your files are not in these formats, convert them beforehand.

> **Note:** You can perform this conversion using [the `convert_webm_and_mkv_to_mp4.sh` script](./scripts/convert_webm_and_mkv_to_mp4.sh), located in the `scripts` directory; just run it inside the location where your videos are saved. If you use an **NVIDIA** graphics card with **CUDA** support, use [the `nvidia_convert_webm_and_mkv_to_mp4.sh` script](./scripts/nvidia_convert_webm_and_mkv_to_mp4.sh) instead.

## Contributing
You can suggest changes to the project by opening an issue [on the project's GitHub page](https://github.com/NathanMBR/telegram-videos-uploader). Pull requests are welcome.

## License
[MIT](./LICENSE)
