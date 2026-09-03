# User Onboarding — what it does

A screen inside the admin panel where our team can add a learner to the
platform by hand, instead of waiting for them to sign up themselves.

Typical use: a customer pays by cheque or bank transfer, a partner sends over a
list of employees, or someone from sales needs an account created on the spot.

## Who can use it

Only admin users whose role includes the "create users" permission. Everyone
else won't see the section at all.

## What you can do

**1. See all users**
A searchable list of everyone in the system, shown a page at a time. Type in the
search box and the list filters as you type.

**2. Add a new user**
Fill in the form and the account is created. **Only the email address is
required** — everything else (name, mobile, location, courses, employer, and so
on) is optional and can be added later.

The form helps where it can:

- Start typing a city and it suggests real locations.
- Start typing a company name and it suggests companies we already have.
- Picking a work sector narrows the job-role list to that sector.
- The partner code is pre-filled with the Creator plan; change it if needed.

**3. Edit an existing user**
Open a user from the list and update their details.

_Important:_ editing only updates the boxes you fill in. Clearing a box out
leaves the old value in place rather than erasing it — so today the screen can
add and change information, but not remove it. Tell us if removing needs to work
and we'll get the backend to support it.

**4. Record an offline payment**
Upload the customer's invoice against their account. Once it goes through, their
subscription is activated — this is how we handle people who didn't pay online.

## Things to be aware of

- To edit a user, open them from the list. Sharing a direct edit link with
  someone else means the page opens with blank fields.
- Everything happens live against the real system. There is no draft or undo.

## Questions we still need answered

These are waiting on a decision from the business/product side:

1. **Qualification and licence status** — what exactly should the dropdown
   options say? The current wording is our best guess.
2. **Creator plan** — which partner code officially represents it? Right now the
   screen guesses by looking for the word "creator".
3. **Country and years-of-experience** — the system can store these, but there's
   no approved list to pick from yet, so the fields aren't shown.
