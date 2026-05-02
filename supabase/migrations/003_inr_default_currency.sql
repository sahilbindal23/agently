alter table deals alter column currency set default 'inr';

update deals
set currency = 'inr'
where currency is null or lower(currency) = 'usd';
