# 프로젝트 실행 방법 (설치, 실행 명령어)

# API 사용법 (엔드포인트별 요청/응답 예시)

# 구현 관련 상세 설명 및 코멘트

## API 디자인 및 서빙 전략

### `structuredClone`을 사용한 이유

> 해당 내용은 dto 응답으로 개선되었습니다. `status로 데이터 검색은 왜 큰 차이가 없는가`를 참고해 주세요.

node-json-db는 메모리에 json 파일 데이터를 올리고, 이를 통해 요청을 처리하며 save를 통해 파일에 현 데이터를 반영합니다.

이는 곧 'node-json-db가 지정하고 있는 데이터를 변경할 경우, 원치 않던 데이터가 반영될 수 있음'을 뜻합니다.

실제, 배치 작업 초기 구현은 node-json-db의 filter를 통해 얻은 데이터들을 수정하고, 이를 save하는 방식으로 구현되었습니다.

그러나 이는 해당 데이터를 전달받은 service, controller, batch 등의 레이어에서 '임의로 DB에 지정된 데이터를 수정할 수 있음'을 내포합니다.

즉 오남용을 막을 방법이 필요했으며, Job이 repository를 벗어나는 순간 DB와 연관성이 사라지도록 구성해야 했습니다.

`structuredClone`은 deepCopy가 수행된 데이터를 반환하므로, 이를 활용하여 'DB와 무관한 데이터'를 반환하도록 구성했습니다.

이로 인해 기존 배치(업데이트) 작업은
`배치 레이어에서 필터 데이터 수령 -> 직접 데이터 수정 -> save`가 아닌
`서비스 레이어에서 필터 callback과 데이터 수정 callback 전달 -> repository 레이어에서 처리 후 save` 과정으로 변경하였습니다.

## 데이터 처리 전략

### UUID v7을 사용한 이유는?

UUID v1, v2, v6, v7은 TimeStamp를 사용합니다.

v1, v2, v6는 MAC 주소를 기반으로 생성되며, v1과 v2는 시간 순으로 정렬하지 않습니다. 반면 v6와 v7은 시간순으로 정렬이 가능합니다.

v7은 생성 과정에서 MAC 주소를 사용하지 않으며, 시간순으로 정렬이 가능합니다.

따라서 매 요청마다 랜덤한 값을 만들면서도, 생성 환경에 영향을 받지 않고, 생성 시간을 유추할 수 있으며, 생성 시간 순으로 정렬이 가능한 v7을 선택하였습니다.

## 성능 관리 전략

### 인덱스 전략을 사용하려면 어떻게 해야 할까?

다음의 작업들은 인덱스가 존재하는 경우 굉장히 빨라질 수 있습니다.

- 1분마다 status 변경하는 배치 구현
- id로 데이터 조회
- title로 데이터 조회
- status로 데이터 조회

우선 `node-json-db`가 어떻게 데이터를 다루는 지 확인해봐야 합니다. 데이터 조회 시 '빠른 속도'를 위해, 특별한 작업을 하고 있을까요?

아쉽게도, 그렇지 않았습니다.

```
public getObject<T>(dataPath: string): Promise<T> {
    return this.getData(dataPath)
}
```

```
public getData(dataPath: string): Promise<any> {
    return readLockAsync(async () => {
        const path = this.processDataPath(dataPath) // 맨 앞뒤 구분자 자르기
        return this.retrieveData(path, false)
    });
}
```

```
private async retrieveData(dataPath: DataPath, create: boolean = false): Promise<any> {
    await this.load()

    const thisDb = this

    const recursiveProcessDataPath = (data: any, index: number): any => {
        let property = dataPath[index]

        /**
         * Find the wanted Data or create it.
         */
        function findData(isArray: boolean = false) {
            if (data.hasOwnProperty(property)) {
                data = data[property]
            } else if (create) {
                if (isArray) {
                    data[property] = []
                } else {
                    data[property] = {}
                }
                data = data[property]
            } else {
                throw new DataError(
                    `Can't find dataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. Stopped at ${property}`,
                    5
                )
            }
        }

        const arrayInfo = ArrayInfo.processArray(property)
        if (arrayInfo) {
            property = arrayInfo.property
            findData(true)
            if (!Array.isArray(data)) {
                throw new DataError(
                    `DataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. ${property} is not an array.`,
                    11
                )
            }
            const arrayIndex = arrayInfo.getIndex(data, true)
            if (!arrayInfo.append && data.hasOwnProperty(arrayIndex)) {
                data = arrayInfo.getData(data)
            } else if (create) {
                if (arrayInfo.append) {
                    data.push({})
                    data = data[data.length - 1]
                } else {
                    data[arrayIndex] = {}
                    data = data[arrayIndex]
                }
            } else {
                throw new DataError(
                    `DataPath: ${thisDb.config.separator}${dataPath.join(
                        thisDb.config.separator
                    )}. . Can't find index ${arrayInfo.index} in array ${property}`,
                    10
                )
            }
        } else {
            findData()
        }

        if (dataPath.length == ++index) {
            // check data
            return data
        }
        return recursiveProcessDataPath(data, index)
    }

    if (dataPath.length === 0) {
        return this.data
    }

    return recursiveProcessDataPath(this.data, 0)
}
```

```
public async load(): Promise<void> {
    if (this.loaded) {
        return
    }
    try {
        this.data = await this.config.adapter.readAsync();
        this.loaded = true
    } catch (err) {
        throw new DatabaseError("Can't Load Database", 1, err)
    }
}
```

```
async readAsync(): Promise<any> {
    const data = await this.adapter.readAsync(); // fileAsync 사용
    if (data == null || data === '') {
        await this.writeAsync({});
        return {};
    }
    return JSON.parse(data, this.reviver.bind(this));
}
```

```
import {readFile, open, FileHandle, mkdir} from "fs/promises";

async readAsync(): Promise<string | null> {
    try {
        return await readFile(this.filename, {
            encoding: 'utf-8'
        })
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw e
    }
}
```

```
private readonly dateRegex = new RegExp('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', 'm') // YYYY-MM-DDTHH:mm:ss

private reviver(key: string, value: any): any {
    if (typeof value == "string" && this.dateRegex.exec(value) != null) {
        return new Date(value);
    }
    return value;
}
```

즉, 특별한 과정 없이 '메모리에 올린 데이터'를 읽어오는 것으로 파악되었습니다.

만약 데이터가 굉장히 많은 경우, 메모리에 적재하는 데 굉장히 오래 걸릴 것입니다.

이는 매우 당연하게도, Json을 통해 데이터 저장 및 획득이 약속되어 있는 라이브러리이기 때문입니다.

만약 'pc의 메모리 용량을 초과할 정도로 많은 데이터'를 가져온다면 어떻게 될까요?

가상 메모리 용량이 0이라고 가정하는 경우, 프로세스는 죽어버리고 말 것입니다.

대용량 데이터 및 인덱스 사용을 위해서는 따로 DB를 사용하거나, node-json-db를 통해 실제 DB의 동작을 흉내낼 수 있어야 합니다.

과제 조건에서는 무조건 node-json-db를 사용하도록 작성되어 있습니다.

~~따라서 인덱스 기법을 활용하기 위해선 node-json-db를 이용하되, 실제 대용량 DB처럼 동작하도록 설계해야 할 것입니다.~~

node-json-db는 파일 전체를 메모리에 올릴 뿐 부분적인 파일을 읽어오지 못 하며, 요구사항에서는 `작업 데이터는 jobs.json 파일에 저장`하도록 되어 있습니다.

즉 작업 데이터들의 일부를 jobs.json에 작성하고, 인덱싱 등의 작업을 위한 추가적인 데이터들을 다른 파일에 작성한다면 요구사항에 벗어나는 설계가 됩니다.

또한, '모든 파일 내용을 메모리에 적재'하는 node-json-db의 근본적인 한계는 벗어날 수 없습니다.

### 적재된 메모리 내에서 빠르게 해결하려면

프로젝트를 통해 이루고자 하는 건 'pending된 job들을 completed로 변경'입니다.

앞서 설명드렸듯 node-json-db는 파일 데이터를 모두 메모리에 올려 이를 관리합니다.

하지만 매번 pending job들을 completed로 변경하기 위해선, job들을 필터링한 후 데이터를 업데이트해야 합니다.

필터링 연산도 리소스가 들어가는 작업이므로, 미리 pending jobs와 completed jobs를 구분하도록 내부 로직을 변경하면 훨씬 빠르게 해결할 수 있을 것입니다.

이로 인해 인덱스 처리가 아닌, 현재 요구사항에 맞는 간단한 방법을 통해 메모리 사용량은 조금 늘어나겠지만 내부 처리 속도는 빠르게 구성할 수 있을 것입니다.

node-json-db는 데이터가 필요한 대부분의 메서드에 `retrieveData`가 요청되며, 내부에서 데이터를 `load`하게 됩니다.

`load`는 config에 설정된 adapter를 통해 동작하는데, 이 때 내부에서는 JsonAdapter와 FileAdapter를 사용합니다.

'node-json-db를 사용하라'는 요구사항을 지키면서도, pending jobs와 completed jobs를 구분하는 방법은 아래와 같은 방법들이 있을 것입니다.

#### 커스텀 Adapter 사용

직접 작성한 Adapter를 사용합니다.

Adapter들은 모두 `IAdapter`를 확장하고 있으며, 이에 맞게 코드를 구성하면 확장이 가능합니다.

그러나 Adapter의 책임은 '어떻게 데이터를 읽고 쓸 것이냐'에 가까우므로, 너무 구체적인 Adapter가 작성된다는 단점이 있습니다.

#### 프록시 Adapter 사용

위와 같은 단점을 방지하고자, 프록시 Adapter를 사용할 수 있습니다.

프록시 Adapter는 실제 Adapter를 통해 Json 파일을 읽거나 쓸 때, 추가적인 로직을 수행할 수 있습니다.

하지만 우리에게 필요한 건 '파일을 읽거나 쓸 때' 사용할 추가적인 동작과는 거리가 있어보이며, 이 역시 너무 구체적입니다.

#### 커스텀 JsonDB 사용

JsonDB 내에 pending jobs와 completed jobs를 구분할 추가적인 필드를 만들고, load 시 이를 구분합니다.

이후 관련된 작업에 대해서 동작하도록 구성합니다.

하지만 이 역시 데이터와 밀접한 관계를 가진 DB가 구성된다는 문제점이 있습니다.

#### repository에서 load된 데이터 참조를 사용

repository 프로바이더가 정상적으로 적재된 이후, `onModuleInit`을 통해 `load`를 실행합니다.

repository는 해당 데이터를 기반으로 미리 pending jobs와 completed jobs를 구분합니다.

이후 배치 혹은 검색 작업 등이 실행되는 경우, 구분된 jobs를 통해 이를 해결합니다.

간단한 코드만으로 구현이 가능하지만, repository의 역할을 벗어날 가능성이 있습니다. 데이터에 따라 job을 구분하는 건 DAO가 아닌 비즈니스 로직에 가깝습니다.

#### service에 로직 구성

앞서 말씀드린 것처럼 구분된 jobs를 지니고 이를 처리하는 건 비즈니스 로직에 더 가깝습니다. 따라서 service에 이를 구성합니다.

하지만 service가 직접적으로 데이터 목록을 지니게 되므로, 이 또한 service의 목적에 맞지 않을 수 있습니다.

#### 추가적인 레이어 사용

비즈니스 로직을 담는 service와, 데이터에 access하는 repository 사이에 '직접 데이터를 조작하는 새로운 계층'을 도입하는 게 훨씬 나은 방법이라 여겨졌습니다.

이는 데이터를 메모리에 적재하여 다루는 node-json-db의 특징과 연결되어 있으므로, service 계층에서는 repository와 같은 계층으로 보여야 합니다.

추후 node-json-db가 아닌 실제 DB 등으로 변경된다면, 해당 계층에도 변화가 일어나야 하기 때문입니다.

#### 결론: repository에서 load된 데이터 참조를 사용하자

현재 repository는 JsonDB와 밀접한 관계를 맺고 있습니다. 이미 '파일 구성을 메모리에 올려 사용함'을 알고 있다는 뜻입니다.

즉 현재 설계는 확장성을 고려하지 않았으므로, 오히려 계층을 분리하기보단 해당 계층에서 데이터를 구분하는 게 더 낫다고 판단하였습니다.

대신 기존 service에서 지니던 '필터 로직'과 '업데이트 로직'을 다시 repository에서 지니도록 구성했습니다.

다만 메서드 동작을 명확히 하기 위해, 필터와 업데이트 로직이 아닌 '이전 상태'와 '이후 상태'를 요청하도록 메서드를 구축했습니다.

### 기존 repository와 데이터 참조 repository 비교

기존 `repository`는 JsonDB를 단순 사용한 `JobsNormalRepository`입니다.

참조 `repository`는 JsonDB를 통해 load한 데이터들을 id, title, status로 구분하여 참조하는 `JobsCacheRepository`입니다.

`src/jobs/service/jobs.service.spec.ts`를 이용하여 시간을 측정했으며, 5회 이상 반복 후 평균을 매겼습니다.

#### 테스트 주의사항

file write는 JsonDB의 FileAdapter를 통해 동일하게 이루어질 것이므로, write 기능은 끄고 동작하도록 구성했습니다.

또한 파일의 메모리 적재 시간이 테스트에 영향을 끼치지 않도록, 모듈 구성 시 JsonDB를 load하도록 구성하였습니다.

데이터는 총 70만개입니다.

비고의 성능 개선율은 `원래 시간 - 개선된 시간` / `원래 시간` * `100`입니다.

모든 시간 측정 단위는 ms입니다.

<table>
  <tr>
    <th>구분</th>
    <th>JobsNormalRepository</th>
    <th>JobsCacheRepository</th>
    <th>비고</th>
  </tr>
  <tr>
    <td>데이터 추가</td>
    <td>2.1040752</td>
    <td>1.9601668</td>
    <td>큰 차이 없음</td>
  </tr>
  <tr>
    <td>id로 데이터 조회</td>
    <td>25.071883</td>
    <td>0.0298836</td>
    <td>99.88% 개선</td>
  </tr>
  <tr>
    <td>모든 데이터 조회</td>
    <td>628.816468</td>
    <td>614.5309</td>
    <td>모든 데이터 조회는 같은 방식을 채택</td>
  </tr>
  <tr>
    <td>title로 데이터 검색</td>
    <td>6.394975</td>
    <td>0.0467918</td>
    <td>99.27% 개선</td>
  </tr>
  <tr>
    <td>status로 데이터 검색</td>
    <td>286.7745</td>
    <td>279.825359</td>
    <td>2.42% 개선, 큰 차이 없음</td>
  </tr>
  <tr>
    <td>title, status로 데이터 검색</td>
    <td>11.7365</td>
    <td>16.8407832</td>
    <td>-43.49%, 로직 개선 필요</td>
  </tr>
  <tr>
    <td>데이터 status 업데이트</td>
    <td>424.70975</td>
    <td>Maximum call stack size exceeded로 실행 불가</td>
    <td>로직 개선 필요</td>
  </tr>
</table>

표를 통해 '다량의 데이터 조회'는 메모리에 적재된 값을 사용하기 때문에 두 방식의 큰 차이가 없다는 것을 확인할 수 있었습니다.

반면 미리 구분지어 둔 데이터들을 조회하는 경우에는 큰 차이가 존재하는 것을 확인할 수 있었습니다.

### 개선

#### title, status 데이터 검색 시간 줄이기

기존 검색 시간은 16.8407832ms로, `JobsNormalRepository`보다 더 느렸습니다.

코드는 다음과 같았습니다.

```typescript
const titleJobs = this.getTitleJobs(title);
const statusJobs = new Set(this.statusJobs.get(status));

return structuredClone(titleJobs.filter(titleJob => statusJobs.has(titleJob)));
```

예상되는 성능 하락 지점은 다음과 같았습니다.

- Set으로 변환하는 과정에서의 오버헤드
- 직접 필터링하는 과정이 아닌, Set에 속하는지 찾는 과정에서의 오버헤드

따라서 이를 다음과 같이 수정하였습니다.

```typescript
const titleJobs = this.getTitleJobs(title);
const statusJobs = this.statusJobs.get(status);

if (titleJobs.length <= statusJobs.length) {
  return structuredClone(titleJobs.filter(job => job.status === status));
}

return structuredClone(statusJobs.filter(job => job.title === title));
```

두 배열의 길이를 비교한 후, 더 짧은 배열 기준으로 내부 필터링을 통해 빠른 속도를 지닐 수 있도록 했습니다.

이로 인해 기존 `16.8407832ms`에서 `3.9397168ms`로, `76.61%` 개선할 수 있었습니다.

#### status 업데이트 시 Maximum call stack size exceeded 해결하기

다량의 Job status를 `pending`에서 `completed`로 업데이트 시, `Maximum call stack size exceeded`이 발생하는 문제가 있었습니다.

```typescript
afterStatusJobs.push(...beforeStatusJobs);
```

해당 부분에서 문제가 발생하였습니다. 35만개의 데이터를 스프레드 작업하면서 콜 스택에 문제가 생긴 듯 했습니다.

```typescript
this.statusJobs.set(afterStatus, beforeStatusJobs.concat(afterStatusJobs));
```

위와 같이 작성하여 문제를 해결했습니다.

추측하기로는 스프레드 과정에서 수많은 데이터 참조가 일어나고, 이에 문제가 생기는 걸로 보입니다.

문제가 발생한 확실한 이유를 알고 싶었습니다만, 명확히 설명된 자료를 찾지 못했습니다.

[v8 엔진의 push](https://github.com/v8/v8/blob/main/src/objects/js-array.tq#L282) 코드를 찾아보기도 했으나, 해당 부분의 문제가 아니라 생각되었습니다.

스프레드 과정 중 콜 스택이 어떻게 구성되는지 확실히 알고 싶습니다. 이 부분은 면접에서 따로 질문드리고 싶습니다.

#### status로 데이터 검색은 왜 큰 차이가 없는가

기존 방식은 메모리에 올라온 값을 필터링 -> 깊은 복사가 동작하게 됩니다.

개선 방식은 이미 참조하고 있는 데이터들에 대해 깊은 복사를 동작시킵니다.

즉, 깊은 복사가 지니는 시간 소요가 필터링 과정을 건너뛴다는 장점을 압도하기 때문이라고 추측하였습니다.

실제 깊은 복사를 수행하지 않았을 경우 기존 방식은 `8~9ms`, 개선 방식은 `0.02~0.03ms`가 측정되었습니다.

즉 `structuredClone`을 사용하여 대량의 데이터에 대해 깊은 복사를 수행하는 경우 시간이 오래 걸린다'는 결론을 얻었습니다.

`structuredClone`은 순환참조를 해결하기 위해, 조우하는 데이터마다 '기존에 복사했던 값인지'를 확인하는 과정이 포함된다고 합니다.

아마 이 과정에서 발생하는 오버헤드에 의해, 수많은 데이터 처리 시 시간이 오래 걸린 것으로 예측합니다.

따라서 `structuredClone` 대신 단순한 dto로 변환하는 방식을 택했습니다. 해당 과정에서의 시간 변화율과 개선율을 재측정했습니다.

<table>
  <tr>
    <th>구분</th>
    <th>JobsNormalRepository</th>
    <th>JobsCacheRepository</th>
  </tr>
  <tr>
    <td>모든 데이터 조회</td>
    <td>628.816468 -> 40.2533164 (93.6% 개선)</td>
    <td>614.5309 -> 40.312642 (93.44% 개선)</td>
  </tr>
  <tr>
    <td>status로 데이터 검색</td>
    <td>286.7745 -> 22.25595 (92.24% 개선)</td>
    <td>279.825359 -> 17.300233 (93.82% 개선)</td>
  </tr>
  <tr>
    <td>title, status로 데이터 검색</td>
    <td>11.7365 -> 6.992175 (40.42% 개선)</td>
    <td>3.9397168 -> 1.1878418 (69.85% 개선)</td>
  </tr>
</table>

### 총 측정 결과

<table>
  <tr>
    <th>구분</th>
    <th>JobsNormalRepository</th>
    <th>JobsCacheRepository</th>
    <th>비고</th>
  </tr>
  <tr>
    <td>데이터 추가</td>
    <td>2.1040752</td>
    <td>1.9601668</td>
    <td>큰 차이 없음</td>
  </tr>
  <tr>
    <td>id로 데이터 조회</td>
    <td>25.071883</td>
    <td>0.0298836</td>
    <td>99.88% 개선</td>
  </tr>
  <tr>
    <td>모든 데이터 조회</td>
    <td>40.2533164</td>
    <td>40.312642</td>
    <td>모든 데이터 조회는 같은 방식을 채택</td>
  </tr>
  <tr>
    <td>title로 데이터 검색</td>
    <td>6.394975</td>
    <td>0.0467918</td>
    <td>99.27% 개선</td>
  </tr>
  <tr>
    <td>status로 데이터 검색</td>
    <td>22.25595</td>
    <td>17.300233</td>
    <td>22.27% 개선</td>
  </tr>
  <tr>
    <td>title, status로 데이터 검색</td>
    <td>6.992175</td>
    <td>1.1878418</td>
    <td>83.01% 개선</td>
  </tr>
  <tr>
    <td>데이터 status 업데이트</td>
    <td>424.70975</td>
    <td>431.479216</td>
    <td>큰 차이 없음</td>
  </tr>
</table>

#### 로직 상 다른 문제가 있다면

기존 방식은 status가 추가되고, 이에 따른 배치 작업이 추가되어도 문제되지 않습니다.

하지만 `cacheRepository`의 현 로직은 이에 민감하게 동작합니다. 데이터 정렬을 따로 수행하지 않기 때문입니다.

status로 구분된 배열을 합치거나 나누는 과정에서, 기존 삽입된 데이터들의 정렬이 어그러질 것입니다.

만약 데이터의 순서가 중요하다면 로직 적용 후 정렬이 수행되어야 하겠지만, 이는 오히려 정렬로 인한 오버헤드가 추가됩니다.

따라서 만약 status가 자주 바뀌는 상황의 경우, 기존 방식대로 메모리에 전체적으로 올려두되 필터링을 통해 이를 조회하는 방법이 더 나을 수 있다고 생각됩니다.

이는 다른 값들(id, title)도 마찬가지일 것입니다. 정말 고효율적인 캐싱을 위해서는 InnoDB의 B+Tree와 같은 방식을 택해야 할 수 있습니다.

## 기타 구현 디테일

### `Repository`에서 `NotFoundException`을 사용하는 게 옳을까?

`NotFoundException`은 `HttpException`을 상속받은 예외입니다. 즉, 이미 `Repository`에서 `Http`로 예외가 반환됨을 알고 있는 형태입니다.

원칙적으로 `Repository`는 상위 레이어인 `Controller` 관련 구성을 몰라야 하므로, 해당 예외는 어디까지나 'DB에 데이터가 없음'을 알려야 합니다.

~~빠른 개발을 위해 임시로 사용하도록 하며, 추후 `filter` 작업으로 개선해 볼 예정입니다.~~

`repository`에서는 undefined를 반환하고, `controller`에서 `NotFoundException`을 발생시키도록 했습니다.

---

# 개발 체크포인트

- [x] NestJS 초기화
- [x] 데이터 저장소 설정
- [x] 작업 생성 API 작성
    - [x] jobs 객체 반환
    - [x] title, description 필수 유효성 추가
- [x] 특정 작업 상세 정보 조회 API 작성
    - [x] jobs 객체 반환
    - [x] 작업이 존재하지 않으면 404
- [x] 모든 작업 목록 조회 API 작성
    - [x] jobs 객체 리스트 반환
- [x] 작업 검색 API 작성
    - [x] 상태나 제목으로 작업 검색
    - [x] jobs 객체 리스트 반환
- [x] 매 1분마다 배치 구현
    - [x] `pending` 상태 작업을 `completed`로 업데이트
    - [x] 상태 변경 시 콘솔 또는 파일(logs.txt)에 로그 기록
- [ ] 성능 및 오류 처리
    - [x] repository 계층을 벗어날 시 반환되는 데이터와 DB의 연관성이 사라지도록 작업
    - [x] API 응답 시간 최대한 빠르게
        - [x] 미리 pending과 completed 구분해두기
        - [x] 미리 id로 구분해두기
        - [x] 미리 title로 구분해두기
        - [x] 테스트 코드를 통해 API 응답 시간 측정해보기
        - [ ] 개선하기
            - [x] title, status 데이터 검색 시간 줄이기
            - [x] status 업데이트 시 Maximum call stack size exceeded 해결하기
            - [x] 대량의 데이터 조회 시 오래 걸리는 이유 확인하고 개선하기
            - [ ] 대량의 데이터 업데이트 시 오래 걸리는 이유 확인하고 개선하기
    - [ ] 동시 요청 시 데이터 무결성 보장
    - [ ] 적절한 오류 처리(유효하지 않은 요청 400, 찾을 수 없는 리소스 404 등)
- [ ] `jobs.json`에 샘플 데이터 셋팅
- [ ] 기본 노드 환경에서 실행되도록 세팅
