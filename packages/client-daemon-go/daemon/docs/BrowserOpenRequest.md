# BrowserOpenRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Incognito** | Pointer to **bool** | Whether to use incognito mode | [optional] 
**RemoteDebug** | Pointer to **bool** | Whether to open the 9222 debug port | [optional] 
**Url** | Pointer to **string** |  | [optional] 

## Methods

### NewBrowserOpenRequest

`func NewBrowserOpenRequest() *BrowserOpenRequest`

NewBrowserOpenRequest instantiates a new BrowserOpenRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBrowserOpenRequestWithDefaults

`func NewBrowserOpenRequestWithDefaults() *BrowserOpenRequest`

NewBrowserOpenRequestWithDefaults instantiates a new BrowserOpenRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetIncognito

`func (o *BrowserOpenRequest) GetIncognito() bool`

GetIncognito returns the Incognito field if non-nil, zero value otherwise.

### GetIncognitoOk

`func (o *BrowserOpenRequest) GetIncognitoOk() (*bool, bool)`

GetIncognitoOk returns a tuple with the Incognito field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIncognito

`func (o *BrowserOpenRequest) SetIncognito(v bool)`

SetIncognito sets Incognito field to given value.

### HasIncognito

`func (o *BrowserOpenRequest) HasIncognito() bool`

HasIncognito returns a boolean if a field has been set.

### GetRemoteDebug

`func (o *BrowserOpenRequest) GetRemoteDebug() bool`

GetRemoteDebug returns the RemoteDebug field if non-nil, zero value otherwise.

### GetRemoteDebugOk

`func (o *BrowserOpenRequest) GetRemoteDebugOk() (*bool, bool)`

GetRemoteDebugOk returns a tuple with the RemoteDebug field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemoteDebug

`func (o *BrowserOpenRequest) SetRemoteDebug(v bool)`

SetRemoteDebug sets RemoteDebug field to given value.

### HasRemoteDebug

`func (o *BrowserOpenRequest) HasRemoteDebug() bool`

HasRemoteDebug returns a boolean if a field has been set.

### GetUrl

`func (o *BrowserOpenRequest) GetUrl() string`

GetUrl returns the Url field if non-nil, zero value otherwise.

### GetUrlOk

`func (o *BrowserOpenRequest) GetUrlOk() (*string, bool)`

GetUrlOk returns a tuple with the Url field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUrl

`func (o *BrowserOpenRequest) SetUrl(v string)`

SetUrl sets Url field to given value.

### HasUrl

`func (o *BrowserOpenRequest) HasUrl() bool`

HasUrl returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


