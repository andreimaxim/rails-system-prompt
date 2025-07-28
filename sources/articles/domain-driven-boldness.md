# Domain Driven Boldness

**By Jorge Manrubia**
*June 13, 2022*

How to create a good domain model is the subject of many books, but here's a lesson I learned at 37signals: don't be aseptic, double down on boldness.

## Tombstonable Example

When removing a person from an account, Basecamp replaces it with a placeholder, represented by this code:

```ruby
module Person::Tombstonable
  def decease
    case
    when deceasable?
      erect_tombstone
      remove_administratorships
      remove_accesses_later
      self
    when deceased?
      nil
    else
      raise ArgumentError, "an account owner cannot be removed. You must transfer ownership first"
    end
  end
end
```

## HEY Screening System Example

The HEY email screening system uses a bold domain model with concepts like "clearance petitions":

```ruby
class Contact < ApplicationRecord
  include Petitioner
  # ...
end

module Contact::Petitioner
  extend ActiveSupport::Concern

  included do
    has_many :clearance_petitions, foreign_key: "petitioner_id", class_name: "Clearance", dependent: :destroy
  end
  # ...
end
```

## Key Insights

The author emphasizes that domain-driven design should:
- Reflect real-world concepts clearly
- Use expressive language
- Add "personality" to code
- Prioritize clarity and understanding

The article concludes by recommending developers "don't be aseptic; double down on boldness" when creating domain models.