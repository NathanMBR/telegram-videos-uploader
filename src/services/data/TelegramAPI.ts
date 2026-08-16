export namespace TelegramAPI {
  type Response<T> = Response.Success<T> | Response.Error

  namespace Response {
    export type Success<T> = {
      ok: true
      result: T
    }

    export type Error = {
      ok: false
      error_code: number
      description: string
    }
  }

  // Response of /getMe
  export type GetMeResponse = Response<{
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username: string
    can_join_groups: boolean
    can_read_all_group_messages: boolean
    supports_inline_queries: boolean
    supports_guest_queries: boolean
    can_connect_to_business: boolean
    has_main_web_app: boolean
    has_topics_enabled: boolean
    allows_users_to_create_topics: boolean
    can_manage_bots: boolean
  }>

  // Response of /getChat
  export type GetChatResponse = Response<{
    id: number
    title: string
    username: string
    type: string
    active_usernames: Array<string>
    description?: string
    can_send_gift: boolean
    has_visible_history: boolean
    can_send_paid_media: boolean
    accepted_gift_types: AcceptedGiftTypes
    photo: Photo
    pinned_message?: PinnedMessage
    available_reactions: Array<ReactionType>
    max_reaction_count: number
    accent_color_id: number
  }>

  type ReactionType = ReactionType.Emoji | ReactionType.CustomEmoji | ReactionType.Paid

  namespace ReactionType {
    export type Emoji = {
      type: 'emoji'
      emoji: string
    }

    export type CustomEmoji = {
      type: 'custom_emoji'
      custom_emoji_id: string
    }

    export type Paid = {
      type: 'paid'
    }
  }

  type AcceptedGiftTypes = {
    unlimited_gifts: boolean
    limited_gifts: boolean
    unique_gifts: boolean
    premium_subscription: boolean
    gifts_from_channels: boolean
  }

  type Photo = {
    small_file_id: string
    small_file_unique_id: string
    big_file_id: string
    big_file_unique_id: string
  }

  type PinnedMessage = {
    message_id: number
    sender_chat: SenderChat
    chat: Chat
    date: number
    edit_date: number
    text: string
  }

  type SenderChat = {
    id: number
    title: string
    username: string
    type: string
  }

  type Chat = {
    id: number
    title: string
    username: string
    type: string
  }

  // Response of /sendVideo
  export type SendVideoResponse = Response<{
    message_id: number
    sender_chat: SenderChat
    chat: Chat
    date: number
    video: Video
    caption: string
    has_protected_content: boolean
  }>

  type Video = {
    duration: number
    width: number
    height: number
    file_name: string
    mime_type: string
    cover: Array<Video.Cover>
    thumbnail: Video.Thumbnail
    thumb?: Video.Thumbnail
    file_id: string
    file_unique_id: string
    file_size: number
  }

  namespace Video {
    export type Cover = {
      file_id: string
      file_unique_id: string
      file_size: number
      width: number
      height: number
    }

    export type Thumbnail = {
      file_id: string
      file_unique_id: string
      file_size: number
      width: number
      height: number
    }
  }

  // Response of /deleteMessage
  export type DeleteMessageResponse = Response<boolean>

  // Response of /deleteMessages
  export type DeleteMessagesResponse = Response<boolean>
}
