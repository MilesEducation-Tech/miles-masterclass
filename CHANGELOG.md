# Changelog

## [3.3.0](https://github.com/MilesEducation-Tech/miles-masterclass/compare/v3.2.0...v3.3.0) (2026-10-10)


### Features

* **layout:** draw a hand-drawn underline under the AI Labs link ([#94](https://github.com/MilesEducation-Tech/miles-masterclass/issues/94)) ([fd16030](https://github.com/MilesEducation-Tech/miles-masterclass/commit/fd16030d366d69915115b56b2301f8ccc182603a))
* **layout:** give the footer a glass-and-glow finish ([#93](https://github.com/MilesEducation-Tech/miles-masterclass/issues/93)) ([469cbcb](https://github.com/MilesEducation-Tech/miles-masterclass/commit/469cbcb703a0a5da17116c106d418eac33f42562))
* **layout:** give the header a glass-and-glow finish ([#97](https://github.com/MilesEducation-Tech/miles-masterclass/issues/97)) ([5d3ada0](https://github.com/MilesEducation-Tech/miles-masterclass/commit/5d3ada071d55631e9029654f674f03ab7489c78c))
* **layout:** reorder the header nav for guests and members ([#96](https://github.com/MilesEducation-Tech/miles-masterclass/issues/96)) ([d05ed98](https://github.com/MilesEducation-Tech/miles-masterclass/commit/d05ed9829b202372359e238ec260a4ff45693eaf))


### Bug Fixes

* **layout:** align the footer at every breakpoint ([#92](https://github.com/MilesEducation-Tech/miles-masterclass/issues/92)) ([4416262](https://github.com/MilesEducation-Tech/miles-masterclass/commit/441626265e71088cee63f0c59a2c3558bd960bbb))
* **layout:** remove conflict markers left in animation.css ([#99](https://github.com/MilesEducation-Tech/miles-masterclass/issues/99)) ([739fccf](https://github.com/MilesEducation-Tech/miles-masterclass/commit/739fccfcf40b936e54941f5c8f61250f585ce996))
* **shared:** restore focus rings, add a skip link, fix the Play caption ([#95](https://github.com/MilesEducation-Tech/miles-masterclass/issues/95)) ([1903522](https://github.com/MilesEducation-Tech/miles-masterclass/commit/19035229d36a214602818435710a43c4cd691254))

## [3.2.0](https://github.com/MilesEducation-Tech/miles-masterclass/compare/v3.1.0...v3.2.0) (2026-10-09)


### Features

* **offerings:** join live webinars in the app, one session at a time ([#88](https://github.com/MilesEducation-Tech/miles-masterclass/issues/88)) ([25d5ba4](https://github.com/MilesEducation-Tech/miles-masterclass/commit/25d5ba40d0a58cb3a9a4f04bbda34b0b584b45d7))


### Bug Fixes

* **offerings:** let the webinar FAQ categories open ([#91](https://github.com/MilesEducation-Tech/miles-masterclass/issues/91)) ([55fa306](https://github.com/MilesEducation-Tech/miles-masterclass/commit/55fa306aacf83879247b87bf7fc6c41adbc35127))

## [3.1.0](https://github.com/MilesEducation-Tech/miles-masterclass/compare/v3.0.1...v3.1.0) (2026-10-09)


### Features

* **assessment:** bind the result report to [#11](https://github.com/MilesEducation-Tech/miles-masterclass/issues/11) ([b847bf6](https://github.com/MilesEducation-Tech/miles-masterclass/commit/b847bf6b7a73554b623e29af2286d3c173b0dfa6))
* **auth:** accessible OTP input, signed-in shell and PROFILE_STATUS cookie ([#42](https://github.com/MilesEducation-Tech/miles-masterclass/issues/42)) ([59b38c4](https://github.com/MilesEducation-Tech/miles-masterclass/commit/59b38c40610e59344a0864e5102c45e640c5499c))
* **auth:** call auth-identify as an async validator on the identifier field ([15335f5](https://github.com/MilesEducation-Tech/miles-masterclass/commit/15335f5a9cdc2fff399541e1d1d2594bfb24cfe5))
* **auth:** rebuild learner auth on MilesCAIRA Accounts v1 ([444d638](https://github.com/MilesEducation-Tech/miles-masterclass/commit/444d638e87ad3a2bea47dc1d806111ed50529ee3))
* **auth:** translate the login page ([#58](https://github.com/MilesEducation-Tech/miles-masterclass/issues/58)) ([377ec27](https://github.com/MilesEducation-Tech/miles-masterclass/commit/377ec27be973f9f52feb087dbd049ca7a9f3a19c))
* **auth:** translate the profile page and sign-in messages ([#59](https://github.com/MilesEducation-Tech/miles-masterclass/issues/59)) ([749e721](https://github.com/MilesEducation-Tech/miles-masterclass/commit/749e72142d8f7841ffec9a74900aebd63904c265))
* **caira:** bind the endpoints the shipped CAIRA LMS calls ([36bb915](https://github.com/MilesEducation-Tech/miles-masterclass/commit/36bb915ab760b4e831ec6b2d14ccbf2664378937))
* **caira:** bind the masterclass catalog (P3, listing) ([623c6ae](https://github.com/MilesEducation-Tech/miles-masterclass/commit/623c6ae4a2011f5de097d2a512aaa9464479bcce))
* **caira:** bind the transport core and auth to the CAIRA Web API ([ad14640](https://github.com/MilesEducation-Tech/miles-masterclass/commit/ad14640b42d042a86a7e7c94158a47f576ef65a7))
* **chapter:** bind the chapter player to [#6](https://github.com/MilesEducation-Tech/miles-masterclass/issues/6)/[#18](https://github.com/MilesEducation-Tech/miles-masterclass/issues/18) and force CPE mode on ([4653ea9](https://github.com/MilesEducation-Tech/miles-masterclass/commit/4653ea94ec2e90ea58c5aabd65a4d39f30297fe3))
* **core:** add an environment master switch for languages ([#57](https://github.com/MilesEducation-Tech/miles-masterclass/issues/57)) ([2d9b68a](https://github.com/MilesEducation-Tech/miles-masterclass/commit/2d9b68abbedabeb85ff8c4e3f02fb46f08a06093))
* **core:** add Transloco with per-language JSON and a language switcher ([#50](https://github.com/MilesEducation-Tech/miles-masterclass/issues/50)) ([b7b3ca9](https://github.com/MilesEducation-Tech/miles-masterclass/commit/b7b3ca912ac813fc444715c006adf14a26f93dbd))
* **core:** resolve the country from the URL and edge IP and drop timezone detection ([#48](https://github.com/MilesEducation-Tech/miles-masterclass/issues/48)) ([771d622](https://github.com/MilesEducation-Tech/miles-masterclass/commit/771d622e94ea33beedf201f2f92f650854882873))
* **core:** resolve the visitor's language and send it to the API ([#49](https://github.com/MilesEducation-Tech/miles-masterclass/issues/49)) ([6cf415d](https://github.com/MilesEducation-Tech/miles-masterclass/commit/6cf415d535fc1817bf21d429094170a7b19f4eab))
* **cpe-tracker:** reshape the tracker to CAIRA's data and bind it ([ad92f8c](https://github.com/MilesEducation-Tech/miles-masterclass/commit/ad92f8c888b20feb31ba06d281ec9e8556447031))
* **feedback:** bind course feedback to [#12](https://github.com/MilesEducation-Tech/miles-masterclass/issues/12)/[#13](https://github.com/MilesEducation-Tech/miles-masterclass/issues/13), the recipe end to end ([cd10630](https://github.com/MilesEducation-Tech/miles-masterclass/commit/cd106302fea4b19cff86bf24d90f75e77f762b7d))
* **home:** add the live webinar ticket ([#73](https://github.com/MilesEducation-Tech/miles-masterclass/issues/73)) ([5d1710d](https://github.com/MilesEducation-Tech/miles-masterclass/commit/5d1710d1a49c75ac614816e1cef640971c0a6849))
* **home:** add the pricing section and redesign the app download ([#72](https://github.com/MilesEducation-Tech/miles-masterclass/issues/72)) ([212c744](https://github.com/MilesEducation-Tech/miles-masterclass/commit/212c744946353db00147c22d60f6af8316290441))
* **home:** rebuild the sections on the masterclass home-page tracks ([#70](https://github.com/MilesEducation-Tech/miles-masterclass/issues/70)) ([8c75a44](https://github.com/MilesEducation-Tech/miles-masterclass/commit/8c75a440f73125c3238b6e5f3cdc9ae1c2740ae0))
* **home:** redesign the hero with the CAIRA copy and the course grid ([#71](https://github.com/MilesEducation-Tech/miles-masterclass/issues/71)) ([4c2367f](https://github.com/MilesEducation-Tech/miles-masterclass/commit/4c2367f9e0fd1f814d98d1568e141fb075ba3fed))
* **layout:** translate the header and footer ([#51](https://github.com/MilesEducation-Tech/miles-masterclass/issues/51)) ([ff54ee6](https://github.com/MilesEducation-Tech/miles-masterclass/commit/ff54ee60a65ae9152c4e0a989adc405aa83d509f))
* **offerings:** bind the masterclass course page to the web API ([#67](https://github.com/MilesEducation-Tech/miles-masterclass/issues/67)) ([12be999](https://github.com/MilesEducation-Tech/miles-masterclass/commit/12be9999bbde726e1acbb0d65cc423c27018a0d8))
* **offerings:** bind the masterclass page tracks to the web API ([#64](https://github.com/MilesEducation-Tech/miles-masterclass/issues/64)) ([94cce71](https://github.com/MilesEducation-Tech/miles-masterclass/commit/94cce71a07eddb7c8c83617c5f02d08d58bfe9e1))
* **offerings:** open the course-info dialog from the home cards ([#83](https://github.com/MilesEducation-Tech/miles-masterclass/issues/83)) ([1bbd867](https://github.com/MilesEducation-Tech/miles-masterclass/commit/1bbd867fe30d3222c5e7e7123f5e713497b28aee))
* **offerings:** replicate the v3 webinar list and detail design per login state ([#47](https://github.com/MilesEducation-Tech/miles-masterclass/issues/47)) ([ed971f3](https://github.com/MilesEducation-Tech/miles-masterclass/commit/ed971f3a08c39221ad979d18de6007e3de9b1641))
* **shared:** port the v3 AI Labs ring visuals ([#76](https://github.com/MilesEducation-Tech/miles-masterclass/issues/76)) ([454a877](https://github.com/MilesEducation-Tech/miles-masterclass/commit/454a87747b7b2a8d92fa9551e4e6cef42c1a7ec2))
* **shared:** port the v3 CAIRA stack cross-fade ([#77](https://github.com/MilesEducation-Tech/miles-masterclass/issues/77)) ([65c6e2f](https://github.com/MilesEducation-Tech/miles-masterclass/commit/65c6e2fd10920c2450a166aa259c1b81ef5fe100))
* **webinar:** rebuild the webinar module on the Events v1 contract ([cb635d1](https://github.com/MilesEducation-Tech/miles-masterclass/commit/cb635d15e39bf1718013483d2bc1fe498ea32cdf))


### Bug Fixes

* `methods.includes('otp')` made every login impossible ([15335f5](https://github.com/MilesEducation-Tech/miles-masterclass/commit/15335f5a9cdc2fff399541e1d1d2594bfb24cfe5))
* **auth:** bearer on logout, transient refresh failures, 502 split, strict session types ([#35](https://github.com/MilesEducation-Tech/miles-masterclass/issues/35)) ([2540daa](https://github.com/MilesEducation-Tech/miles-masterclass/commit/2540daa1efc23e753be46051afeab3ba223c9896))
* **auth:** rebind the user record to user-details/ and drop the deleted row PATCH ([#36](https://github.com/MilesEducation-Tech/miles-masterclass/issues/36)) ([de53707](https://github.com/MilesEducation-Tech/miles-masterclass/commit/de53707548227475c3bfe160c381d5ada6a3a695))
* **cards:** fetch the info dialog's about section from [#4](https://github.com/MilesEducation-Tech/miles-masterclass/issues/4) ([e8a9f73](https://github.com/MilesEducation-Tech/miles-masterclass/commit/e8a9f733d8e0770cc929aebe88bc485abdd5ddd1))
* **chapter:** follow the server's is_video_seekable, not a client rule ([a2a4d74](https://github.com/MilesEducation-Tech/miles-masterclass/commit/a2a4d7412bc02ad716adb35084c8806bce02d626))
* **chapter:** read the transcript from [#4](https://github.com/MilesEducation-Tech/miles-masterclass/issues/4) instead of a deleted facade ([27c4774](https://github.com/MilesEducation-Tech/miles-masterclass/commit/27c47741af4f629e176e8e1b3a844f72a3af50b3))
* **chapter:** type the players against ChapterView, restoring podcast audio ([4adf48b](https://github.com/MilesEducation-Tech/miles-masterclass/commit/4adf48bcb79df5bd2558ca64434c629d7672619d))
* **core:** make the global loading bar visible and skippable per request ([#84](https://github.com/MilesEducation-Tech/miles-masterclass/issues/84)) ([788441a](https://github.com/MilesEducation-Tech/miles-masterclass/commit/788441aab3651d0ca85d04c561649892927e2dc6))
* mirror the feature pages under Arabic and enable it on UAT ([#56](https://github.com/MilesEducation-Tech/miles-masterclass/issues/56)) ([3587bf1](https://github.com/MilesEducation-Tech/miles-masterclass/commit/3587bf102ad918a64567437219e93e289c6b3c7b))
* **offerings:** bind the webinar page to the current feed contract ([#43](https://github.com/MilesEducation-Tech/miles-masterclass/issues/43)) ([bc3385f](https://github.com/MilesEducation-Tech/miles-masterclass/commit/bc3385fd14b3a7e263b6543879534001435e6aaa))
* **offerings:** read the masterclass tracks from tracks-page/ ([#78](https://github.com/MilesEducation-Tech/miles-masterclass/issues/78)) ([071bc98](https://github.com/MilesEducation-Tech/miles-masterclass/commit/071bc98ad63a11fe9daa520fa9318380b739ef28))
* **offerings:** read total_cpe_credits and correct the webinar detail CTA ([#37](https://github.com/MilesEducation-Tech/miles-masterclass/issues/37)) ([598a258](https://github.com/MilesEducation-Tech/miles-masterclass/commit/598a25873abeb2c7ff6aa0e73930a6b6698fbe8a))
* **offerings:** restore the course-info dialog on the masterclass cards ([#68](https://github.com/MilesEducation-Tech/miles-masterclass/issues/68)) ([bca3ad8](https://github.com/MilesEducation-Tech/miles-masterclass/commit/bca3ad8d4e6c851aa4aefe72c7593feacf948567))
* **profile:** remove two controls that could not be filled or saved ([9a321ee](https://github.com/MilesEducation-Tech/miles-masterclass/commit/9a321eec4af46e3bbd4b19699dc03d7d1d2e6179))
* **review:** guard [#4](https://github.com/MilesEducation-Tech/miles-masterclass/issues/4)'s error body and restore a displaced doc comment ([61757c6](https://github.com/MilesEducation-Tech/miles-masterclass/commit/61757c61b239b86d40f9b5699ab85a23c69a3773))
* **review:** repair four broken back-navigations and an unreachable fallback ([18b4e5d](https://github.com/MilesEducation-Tech/miles-masterclass/commit/18b4e5d073a3f0e9de1f4303e5b2cdd010a6505f))
* **shared:** keep left-to-right content left-to-right under Arabic ([#54](https://github.com/MilesEducation-Tech/miles-masterclass/issues/54)) ([94b0450](https://github.com/MilesEducation-Tech/miles-masterclass/commit/94b0450b48dc0fedeeda41cbd2276dd1b7753c1d))
* **shared:** make the per-page loading indicators render ([#85](https://github.com/MilesEducation-Tech/miles-masterclass/issues/85)) ([741d0f7](https://github.com/MilesEducation-Tech/miles-masterclass/commit/741d0f7e35efefc6b50d395b0ebf09490b23af8d))
* **shared:** mirror direction-dependent shared UI under Arabic ([#55](https://github.com/MilesEducation-Tech/miles-masterclass/issues/55)) ([24c228b](https://github.com/MilesEducation-Tech/miles-masterclass/commit/24c228b12357c66bfea36202dbbc58469dd0c616))
* **stubs:** remove two more crash paths — slider bound, quiz honestly blocked ([c4142b3](https://github.com/MilesEducation-Tech/miles-masterclass/commit/c4142b3401e9d3e6aea25de8aa3aa0c8ab33d27c))
* **stubs:** stop the profile-completion dialog hanging on a dead save ([ad75ef2](https://github.com/MilesEducation-Tech/miles-masterclass/commit/ad75ef21c1fbbd4fb10dfcdc6b41cae281940b10))
* **stubs:** stop two blocked flows from posting to an empty URL ([3f2137f](https://github.com/MilesEducation-Tech/miles-masterclass/commit/3f2137f38cc8a05b530303098e0636fcc4b60514))
* **webinar:** allow camera, and isolate the live route for the Zoom SDK ([3125459](https://github.com/MilesEducation-Tech/miles-masterclass/commit/3125459d6f52fce44be9ed2dd07eb50385b0035a))
* **webinar:** rewire the premiere card to the registration that already exists ([447508c](https://github.com/MilesEducation-Tech/miles-masterclass/commit/447508cedd31f863f933ee89bb15c2010f9cc834))
* **webinar:** stop the guest registration form hanging, and stop routing into it ([c3d7340](https://github.com/MilesEducation-Tech/miles-masterclass/commit/c3d7340a84cbd98beaa7685df557830cc5e60f7c))


### Performance Improvements

* **core:** self-host the web fonts ([#75](https://github.com/MilesEducation-Tech/miles-masterclass/issues/75)) ([d91bf38](https://github.com/MilesEducation-Tech/miles-masterclass/commit/d91bf38b1c48a2cff5a850157e84354c8dd35b03))
* **shared:** render carousel slides only once Swiper is registered ([#74](https://github.com/MilesEducation-Tech/miles-masterclass/issues/74)) ([72aa253](https://github.com/MilesEducation-Tech/miles-masterclass/commit/72aa25325baa321fdd4a4fd2517555279abda646))
