# How DHH organizes his Rails controllers

**By Jerome Dalbert | February 28, 2016**

*This article is also available in [Japanese](http://postd.cc/how-dhh-organizes-his-rails-controllers/). すごい!*

A few years ago I worked on a large Rails codebase which had some pretty complex controllers. My pair and I often had trouble placing our new sub-resources or sub-states: should it be a method on the existing controller? Or should we extract it into its own controller?

One random Tuesday, we were lucky enough to have lunch with DHH and a few other colleagues. During the meal, someone asked this very question about controllers, which prompted David to explain his approach. He laid out a few points:

> I create a new controller for any sub-resource or sub-state that I can extract from the 7 default CRUD actions of a controller, and I namespace that controller under the resource name. *Fundamentally, I am a zealot about never creating any actions beyond the default 7 actions*.

For example, if he wants to create a controller for `pendings` on the `Inbox` resource, he does not add a `def pendings` method in `InboxesController`, he creates an `Inboxes::PendingsController` with an `def index` method.

So instead of:

```ruby
class InboxesController < ApplicationController
  def index
  end
  
  def pendings
  end
end
```

He does:

```ruby
class InboxesController < ApplicationController
  def index
  end
end

class Inboxes::PendingsController < ApplicationController
  def index
  end
end
```

> Being fundamentalistic about creating new controllers and staying adherent to REST has served me better every single time. Yes, it might take me 1 extra minute to create a new controller, and yes, it might feel a bit silly sometimes. But in the long run it is better, and I have never been in a situation where I regret having done that.

Since that lunch we have been much more liberal about creating controllers, especially for the more complex resources and mixed concerns. On the other hand, we never feel like we *have* to extract from extremely simple resources, but it's nice to know that's always an option.

I believe there are 3 main benefits from controller splitting.

## It encourages you to make simpler code

If you have the habit of shoving functionality into existing controllers, it can quickly lead to 200+ lines controller behemoths. I've seen those, and they're hard to maintain.

For example, I once worked on a controller that was doing a lot of things. It would (a) load the Product, Device, and User, (b) create an Order and a Payment (different models, tied together), (c) authorize the Payment, (d) send different analytics events at different points, (e) optionally send a confirmation email for the User (depending on whether they created their account before a certain date), (f) render the response differently based on the device, and a few other things.

It was really long and had a lot of private methods:

```ruby
class Api::V1::PurchasesController < Api::V1::ApplicationController
  rescue_from Stripe::StripeError, with: :log_payment_error

  def create
    load_product
    load_device
    load_or_create_user

    create_order
    create_payment
    authorize_payment
    confirm_address

    render json: @order, status: :created
  end

  private

  def load_product
    @product = Product.find_by!(uuid: params[:product_id])
  end

  def load_device
    @device = Device.find_by!(uuid: params[:device_id])
  end

  def load_or_create_user
    @user = User.find_or_create_by!(email: params[:email]) do |user|
      # ...
    end
  end

  def create_order
    @order = @user.orders.create! do |order|
      # ...
    end
  end

  def create_payment
    @payment = @order.create_payment! do |payment|
      # ...
    end
  end

  def authorize_payment
    # ...
    track_conversion
  end

  def track_conversion
    # ...
  end

  def confirm_address
    # ...
  end

  def log_payment_error(exception)
    # ...
  end
end
```

With a bit of refactoring, it could be possible to push some logic down to the models. Or extract it to a service class. But even then, the controller would still have to orchestrate a lot.

On the other hand, if my pair and I were liberal about creating new controllers, we might have created `Api::V1::Users::PurchasesController`, `Api::V1::Devices::PurchasesController`, maybe `Api::V1::Orders::PaymentsController` or something similar, and each would have handled a smaller chunk of logic.

You have to be careful not to extract prematurely though, and use good judgment. But when things get complex I have found that controller splitting has helped make the code simpler.

## It makes your code more uniform

Knowing that most of the actions in your app only ever use the default CRUD methods is quite nice. For one, it makes it easier to browse the app. And when adding new functionality, I've found that it removes some cognitive overhead because I know that I'll only ever use one of those 7 default methods. It's a simple rule.

It can also help with refactoring. If you have custom methods all over the place, you might not know what to do with them. But if you adhere to REST, it's easier to see how to move things around. I once saw an app with tons of custom controller methods get refactored over a couple of weeks; it was way cleaner with RESTful controllers.

## It encourages you to think in REST

This one takes a bit more practice, especially when you're not used to it. But if you stick to the 7 default methods and think of your problem in terms of resources with REST/CRUD interfaces, you can often come up with a decent structure.

For example, at some point I worked on an app that had a non-RESTful controller with a method `def pay`. This method was creating payments.

But we could have called it `payments#create`. And if we had that restriction in mind, we would have designed this whole area of the app differently from the start, thinking more in terms of resources and CRUD. For instance, if we have a Payment resource, what would the Payment Update be? (maybe updating its state after it's confirmed?) Can you Destroy a payment? (maybe soft delete if refunded?) etc.

Sticking to REST is what 37signals calls a liberating constraint, an idea from the art world:

> Such constraints are liberating because they force you to think about the problem in a different way and come up with solutions that are better and more creative than if you had total freedom.

By putting yourself into this RESTful constraint, you basically have to map any concept in your business logic to a noun (resource), and actions on that noun to a verb (CRUD action). You'd be surprised how often a concept can be mapped this way. Not everything, but I'd say at least 95%. And the more you practice, the more that percentage goes up.

RESTful thinking takes some time to get used to, but I believe the learning curve is worth it. Here are some routes I've seen in the past:

```ruby
resources :purchases, only: :create
resources :costs_calculations, only: :create

namespace :company do
  resource :account_details, only: :update
  resource :website_details, only: :update
  resource :contact_details, only: :update
end

namespace :balance do
  resources :funds, only: :create
end

resource :bank_account, only: :update
```

They may seem weird at first (a `BalanceFund` resource?), but I've gotten used to them and they are now easy to work with.

## Conclusion

Splitting Rails controllers can often lead to simpler code, more uniform structures, and better REST/CRUD interfaces. Next time you think about adding a custom method on a controller, think about extracting it to its own controller. It might take 1 extra minute, but you probably won't regret it, especially as your app grows and increases in complexity.

And if you're interested in this topic, you should listen to the original source: [DHH's interview on the Full Stack Radio podcast](http://fullstackradio.com/32), especially around the 27 minute mark, but really the whole episode is great. Among other things, he explains his take on Concerns, Russian-doll caching, and why developers should write more controllers. Enjoy!

---

*Update 2018: I wrote a new article about a similar topic, [Rails modules: include vs prepend vs extend](http://jeromedalbert.com/rails-modules-include-vs-prepend-vs-extend/).*