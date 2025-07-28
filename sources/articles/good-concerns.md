# Good Concerns

**By Jorge Manrubia**
*October 10, 2022*

## Overview

Rails concerns have been controversial, but 37signals has developed principles for using them effectively in large codebases. This article explores their approach to using concerns as a code organization and readability tool.

## Key Principles

### Where to Put Concerns

- Common model concerns: `app/models/concerns`
- Model-specific concerns: `app/models/<model_name>`

Example:
```ruby
# app/models/recording.rb
class Recording < ApplicationRecord
  include Completable
end

# app/models/recording/completable.rb
module Recording::Completable
  extend ActiveSupport::Concern
end
```

### Improving Readability

Concerns can improve code organization by:
1. Managing complexity
2. Reflecting domain concepts

Example from HEY's User model:
```ruby
class User < ApplicationRecord
  include Examiner
end

module User::Examiner
  extend ActiveSupport::Concern

  included do
    has_many :clearances, foreign_key: "examiner_id", class_name: "Clearance", dependent: :destroy
  end

  def approve(contacts)
    # Implementation
  end
end
```

### Complementing Object-Oriented Design

Concerns should enhance, not replace, traditional object-oriented techniques. They work well with:
- Value objects
- Service classes
- Composition
- Inheritance

## Conclusion

Concerns are a pragmatic tool for improving code organization when used thoughtfully. They can create more readable and maintainable code without sacrificing software design principles.