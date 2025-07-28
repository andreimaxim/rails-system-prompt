# Globals, callbacks and other sacrileges

**By Jorge Manrubia**
*July 31, 2023*

## Introduction

The article discusses how 37signals uses certain Rails techniques that some developers recommend avoiding, specifically focusing on callbacks, `CurrentAttributes`, and `.suppress`.

## Callbacks

The author demonstrates using callbacks to create associated records automatically. For example, in creating a `Project`, a callback ensures a `Bucket` is created:

```ruby
module Bucketable
  extend ActiveSupport::Concern

  included do
    after_create { create_bucket! account: account unless bucket.present? }
  end
end
```

The key argument is that callbacks work well for simple, secondary operations that don't warrant a separate factory or complex logic.

## CurrentAttributes

The article shows how `Current` can be used to track request-level attributes across the application:

```ruby
class Current < ActiveSupport::CurrentAttributes
  attribute :account, :person
  attribute :http_method, :request_id, :user_agent, :ip_address, :referrer

  delegate :user, :integration, to: :person, allow_nil: true
end
```

This allows for seamless tracking of the current user and request details without explicitly passing them around.

## Callbacks + CurrentAttributes

The example demonstrates tracking events for buckets using a combination of callbacks and `CurrentAttributes`:

```ruby
module Bucket::Eventable
  extend ActiveSupport::Concern

  included do
    has_many :events, dependent: :destroy
    after_create :track_created
  end

  def track_event(action, creator: Current.person, **particulars)
    Event.create! bucket: self, creator: creator, action: action, detail: Event::Detail.new(particulars)
  end
end
```

## Conclusion

The author argues against dogmatic approaches that completely reject certain programming techniques. Instead, he advocates for understanding the tradeoffs and using the right tool for the specific scenario.

Key quote: "Software development is a game of tradeoffs, and any choice you make comes with them."