---
layout: post
title: Кейс от Авито... 
categories: [Product analysis,Statistics,Experiment theory]
---

...a.k.a. первая домашка по теории экспериментов.

Я решил извлечь ещё больше выгоды из того, что я постоянно делаю домашки от Академии Аналитиков Авито, поэтому сегодня мы с вами попробуем проанализировать датасет с результатами прошедшего в Авито эксперимента по тестированию монетизационных продуктов, что бы это ни значило.

Теперь, когда вы испугались фразы "монетизационные продукты", самое время пояснить, что это и вообще как. *Let us dive into*, как говорят американцы.

## Кейс 

Мы - аналитики в продуктовой дискавери команде. На текущий момент приближается начало нового квартала и нам необходимо спланировать эксперименты в нём.

У нас есть два продукта:

- Один *базовый* продукт, который предоставляет минимальный набор услуг на вашем ресурсе;
- Один *продвинутый* продукт, который предоставляет расширенный набор услуг.

На текущий момент на квартал у вашей команды есть для проверки две гипотезы:

- Дополнительное информирование об эффективности услуг будет стимулировать их покупку;
- Повышение цены базового продукта должно стимулировать покупку продвинутого продукта.

## Что мы будем с этим делать?

Для начала давайте загрузим датасет и посмотрим глазами на данные внутри.

### Описание данных
_event_date_ - дата\
_user_id_ - идентификатор пользователя\
_product_ - тип продукта (считай, варианты: A или B для нашего A/B теста)\
_amount_ - сумма покупок\
_transactions_ - количество транзакций

![Посмотрел на датасет глазками](https://github.com/yk4r2/yk4r2.github.io/blob/master/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-05-12.png "посмотрел на датасет глазками")
*Посмотрели на датасет глазками*

Proin convallis mi ac felis pharetra aliquam. Curabitur dignissim accumsan rutrum. In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum.

Phasellus et hendrerit mauris. Proin eget nibh a massa vestibulum pretium. Suspendisse eu nisl a ante aliquet bibendum quis a nunc.

### Some great subheading (h3)

Praesent varius interdum vehicula. Aenean risus libero, placerat at vestibulum eget, ultricies eu enim. Praesent nulla tortor, malesuada adipiscing adipiscing sollicitudin, adipiscing eget est.

> This quote will change your life. It will reveal the secrets of the universe, and all the wonders of humanity. Don't misuse it.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce bibendum neque eget nunc mattis eu sollicitudin enim tincidunt.

### Some great subheading (h3)

Vestibulum lacus tortor, ultricies id dignissim ac, bibendum in velit. Proin convallis mi ac felis pharetra aliquam. Curabitur dignissim accumsan rutrum.

```html
<html>
  <head>
  </head>
  <body>
    <p>Hello, World!</p>
  </body>
</html>
```


In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

#### You might want a sub-subheading (h4)

In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

#### But it's probably overkill (h4)

In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

### Oh hai, an unordered list!!

In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

- First item, yo
- Second item, dawg
- Third item, what what?!
- Fourth item, fo sheezy my neezy

### Oh hai, an ordered list!!

In arcu magna, aliquet vel pretium et, molestie et arcu. Mauris lobortis nulla et felis ullamcorper bibendum. Phasellus et hendrerit mauris.

1. First item, yo
2. Second item, dawg
3. Third item, what what?!
4. Fourth item, fo sheezy my neezy



## Headings are cool! (h2)

Proin eget nibh a massa vestibulum pretium. Suspendisse eu nisl a ante aliquet bibendum quis a nunc. Praesent varius interdum vehicula. Aenean risus libero, placerat at vestibulum eget, ultricies eu enim. Praesent nulla tortor, malesuada adipiscing adipiscing sollicitudin, adipiscing eget est.

Praesent nulla tortor, malesuada adipiscing adipiscing sollicitudin, adipiscing eget est.

Proin eget nibh a massa vestibulum pretium. Suspendisse eu nisl a ante aliquet bibendum quis a nunc.

### Tables

|Title 1               | Title 2               | Title 3               | Title 4              |
|--------------------- | --------------------- | --------------------- | ---------------------|
|lorem                 | lorem ipsum           | lorem ipsum dolor     | lorem ipsum dolor sit|
|lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit|
|lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit|
|lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit | lorem ipsum dolor sit|
